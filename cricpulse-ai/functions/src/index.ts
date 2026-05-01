// =====================================================================
// CricPulse AI — Firebase Cloud Functions (Gen 2)
// Project: apl-pragyaan
// =====================================================================
import { setGlobalOptions }      from "firebase-functions";
import { defineSecret }          from "firebase-functions/params";
import { onRequest }             from "firebase-functions/https";
import { onMessagePublished }    from "firebase-functions/pubsub";
import * as logger               from "firebase-functions/logger";
import * as admin                from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

// ---- Secrets (set via: firebase functions:secrets:set RAPIDAPI_KEY) ----
const RAPIDAPI_KEY_SECRET = defineSecret("RAPIDAPI_KEY");
const GEMINI_KEY_SECRET   = defineSecret("GEMINI_API_KEY");
const GCP_API_KEY_SECRET  = defineSecret("GCP_API_KEY");

const RAPIDAPI_HOST = "cricbuzz-cricket.p.rapidapi.com";
const GEMINI_URL    = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

function setCors(res: any): void {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// =====================================================================
// matchPoller — Fetch live Cricbuzz scorecard → store in Firestore
// GET /matchPoller?matchId=151976
// =====================================================================
export const matchPoller = onRequest(
  { secrets: [RAPIDAPI_KEY_SECRET], cors: true, timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method === "OPTIONS") { setCors(res); res.status(204).send(""); return; }
    setCors(res);

    const matchId = (req.query.matchId as string) || "151976";
    const apiKey  = RAPIDAPI_KEY_SECRET.value();

    if (!apiKey) {
      res.status(503).json({
        error: "RAPIDAPI_KEY not set. Run: firebase functions:secrets:set RAPIDAPI_KEY",
      });
      return;
    }

    try {
      logger.info(`[matchPoller] Fetching matchId=${matchId}`);

      const response = await fetch(
        `https://${RAPIDAPI_HOST}/mcenter/v1/${matchId}/scard`,
        {
          headers: {
            "X-RapidAPI-Key":  apiKey,
            "X-RapidAPI-Host": RAPIDAPI_HOST,
          },
        }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`RapidAPI ${response.status}: ${body}`);
      }

      const raw = await response.json() as any;

      const scorecard = {
        scorecard:           raw.scorecard ?? [],
        ismatchcomplete:     raw.matchHeader?.state === "complete",
        status:              raw.matchHeader?.status ?? raw.status ?? "Match in Progress",
        appindex: {
          seotitle: raw.matchHeader?.matchDescription ?? `Match ${matchId}`,
          weburl:   `https://www.cricbuzz.com/live-cricket-scorecard/${matchId}`,
        },
        responselastupdated: Math.floor(Date.now() / 1000),
      };

      // Persist to Firestore
      await db.doc(`matches/${matchId}`).set(scorecard, { merge: true });
      logger.info(`[matchPoller] ✅ Firestore updated — ${scorecard.status}`);

      // Publish to Pub/Sub (optional — won't fail if topic doesn't exist)
      try {
        const { PubSub } = await import("@google-cloud/pubsub");
        await new PubSub().topic("live-match-events").publishMessage({
          data: Buffer.from(JSON.stringify({ matchId, scorecard, ts: Date.now() })),
          attributes: { matchId, status: scorecard.ismatchcomplete ? "complete" : "live" },
        });
      } catch (pubsubErr: any) {
        logger.info("[matchPoller] Pub/Sub skipped:", pubsubErr.message);
      }

      res.json(scorecard);
    } catch (err: any) {
      logger.error("[matchPoller]", err.message);
      res.status(500).json({ error: err.message, matchId });
    }
  }
);

// =====================================================================
// liveMatches — Discover active cricket matches
// GET /liveMatches
// =====================================================================
export const liveMatches = onRequest(
  { secrets: [RAPIDAPI_KEY_SECRET], cors: true, timeoutSeconds: 15 },
  async (req, res) => {
    if (req.method === "OPTIONS") { setCors(res); res.status(204).send(""); return; }
    setCors(res);

    const apiKey = RAPIDAPI_KEY_SECRET.value();
    if (!apiKey) { res.status(503).json({ error: "RAPIDAPI_KEY not set" }); return; }

    try {
      const r    = await fetch(`https://${RAPIDAPI_HOST}/matches/v1/live`, {
        headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": RAPIDAPI_HOST },
      });
      const raw  = await r.json() as any;
      const matches = (raw.typeMatches ?? [])
        .flatMap((t: any) => t.seriesMatches ?? [])
        .flatMap((s: any) => s.seriesAdWrapper?.matches ?? [])
        .map((m: any) => ({
          id:      m.matchInfo?.matchId,
          team1:   m.matchInfo?.team1?.teamName,
          team2:   m.matchInfo?.team2?.teamName,
          status:  m.matchInfo?.status,
          format:  m.matchInfo?.matchFormat,
        }));
      res.json({ matches, total: matches.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// =====================================================================
// sentimentProxy — Rule-based sentiment (no extra API needed)
// POST /sentimentProxy  body: { text: string }
// =====================================================================
export const sentimentProxy = onRequest(
  { secrets: [GCP_API_KEY_SECRET], cors: true, timeoutSeconds: 10 },
  async (req, res) => {
    if (req.method === "OPTIONS") { setCors(res); res.status(204).send(""); return; }
    setCors(res);
    if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

    const { text } = req.body as { text?: string };
    if (!text) { res.status(400).json({ error: "text required" }); return; }

    const apiKey = GCP_API_KEY_SECRET.value();
    const result = await analyzeSentiment(text, apiKey);
    res.json(result);
  }
);

// =====================================================================
// chatModerationProxy — Sentiment, language and hate-speech checks
// POST /chatModerationProxy  body: { text: string }
// =====================================================================
export const chatModerationProxy = onRequest(
  { secrets: [GCP_API_KEY_SECRET], cors: true, timeoutSeconds: 15 },
  async (req, res) => {
    if (req.method === "OPTIONS") { setCors(res); res.status(204).send(""); return; }
    setCors(res);
    if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

    const { text } = req.body as { text?: string };
    if (!text) { res.status(400).json({ error: "text required" }); return; }

    const apiKey = GCP_API_KEY_SECRET.value();
    const sentiment = await analyzeSentiment(text, apiKey);
    const language = await detectLanguage(text, apiKey);
    const hateSpeech = await detectHateSpeech(text, apiKey);

    if (hateSpeech.blocked) {
      res.json({
        allowed: false,
        reason: "Hate speech recognised.",
        language,
        sentimentScore: sentiment.score,
        sentimentLabel: sentiment.label,
        source: hateSpeech.source,
      });
      return;
    }

    res.json({
      allowed: true,
      reason: null,
      language,
      sentimentScore: sentiment.score,
      sentimentLabel: sentiment.label,
      source: sentiment.source,
    });
  }
);

// =====================================================================
// geminiProxy — Secure Gemini 1.5 Flash proxy
// POST /geminiProxy  body: { messages, userMessage, systemPrompt? }
// =====================================================================
export const geminiProxy = onRequest(
  { secrets: [GEMINI_KEY_SECRET], cors: true, timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method === "OPTIONS") { setCors(res); res.status(204).send(""); return; }
    setCors(res);
    if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

    const { messages = [], userMessage, systemPrompt } = req.body as {
      messages?: Array<{ role: string; text: string }>;
      userMessage?: string;
      systemPrompt?: string;
    };
    if (!userMessage) { res.status(400).json({ error: "userMessage required" }); return; }

    const apiKey = GEMINI_KEY_SECRET.value();
    if (!apiKey) {
      res.status(503).json({
        error: "GEMINI_API_KEY not set. Run: firebase functions:secrets:set GEMINI_API_KEY",
      });
      return;
    }

    try {
      const body = {
        ...(systemPrompt ? { system_instruction: { parts: [{ text: systemPrompt }] } } : {}),
        contents: [
          ...messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
          { role: "user", parts: [{ text: userMessage }] },
        ],
        generationConfig: { temperature: 0.8, topK: 40, topP: 0.95, maxOutputTokens: 256 },
      };

      const r = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);

      const data = await r.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Let me think...";
      res.json({ text });
    } catch (err: any) {
      logger.error("[geminiProxy]", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// =====================================================================
// pubsubConsumer — Process live-match-events from Pub/Sub
// =====================================================================
export const pubsubConsumer = onMessagePublished(
  { topic: "live-match-events", timeoutSeconds: 30 },
  async (event) => {
    try {
      const raw = event.data.message.data
        ? JSON.parse(Buffer.from(event.data.message.data, "base64").toString())
        : {};
      const { matchId, scorecard } = raw as { matchId: string; scorecard: any };
      logger.info(`[pubsubConsumer] Processing match ${matchId}`);

      const innings: any[] = scorecard?.scorecard ?? [];
      const currentInnings = innings[innings.length - 1];
      if (currentInnings) {
        await db.doc(`matches/${matchId}/state/live`).set({
          score:    currentInnings.score,
          wickets:  currentInnings.wickets,
          overs:    currentInnings.overs,
          runrate:  currentInnings.runrate,
          batting:  currentInnings.batteamname,
          status:   scorecard.status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      logger.info(`[pubsubConsumer] ✅ State written for match ${matchId}`);
    } catch (err: any) {
      logger.error("[pubsubConsumer]", err.message);
    }
  }
);

// ---- Local rule-based sentiment ----
function localSentiment(text: string): number {
  const t = text.toLowerCase();
  const pos = ["great","amazing","brilliant","fire","wow","wicket","six","four","win","love","awesome","🔥","⭐","🎯","🏆"];
  const neg = ["terrible","awful","bad","worst","hate","horrible","rubbish","useless","😤","😡"];
  let score = 0;
  pos.forEach(w => { if (t.includes(w)) score += 0.25; });
  neg.forEach(w => { if (t.includes(w)) score -= 0.35; });
  return Math.max(-1, Math.min(1, score));
}

async function analyzeSentiment(text: string, apiKey: string) {
  if (!apiKey) {
    const score = localSentiment(text);
    const label = score > 0.2 ? "happy" : score < -0.2 ? "angry" : "neutral";
    return { score, magnitude: Math.abs(score), label, source: "local" };
  }

  try {
    const response = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document: { type: "PLAIN_TEXT", content: text },
        encodingType: "UTF8",
      }),
    });

    if (response.ok) {
      const data = await response.json() as any;
      const score = Number(data?.documentSentiment?.score ?? 0);
      const magnitude = Number(data?.documentSentiment?.magnitude ?? Math.abs(score));
      const label = score > 0.2 ? "happy" : score < -0.2 ? "angry" : "neutral";
      return { score, magnitude, label, source: "gcp-nl" };
    }
  } catch (err: any) {
    logger.error("[sentimentProxy]", err.message);
  }

  const score = localSentiment(text);
  const label = score > 0.2 ? "happy" : score < -0.2 ? "angry" : "neutral";
  return { score, magnitude: Math.abs(score), label, source: "local-fallback" };
}

async function detectLanguage(text: string, apiKey: string) {
  if (!apiKey) return "en";

  try {
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text }),
    });

    if (response.ok) {
      const data = await response.json() as any;
      return data?.data?.detections?.[0]?.[0]?.language ?? "en";
    }
  } catch (err: any) {
    logger.error("[chatModerationProxy] language detect", err.message);
  }

  return "en";
}

async function detectHateSpeech(text: string, apiKey: string) {
  if (!apiKey) {
    return { blocked: localHateSpeech(text), source: "local" };
  }

  try {
    const response = await fetch(`https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: { text },
        languages: ["en"],
        requestedAttributes: {
          TOXICITY: {},
          INSULT: {},
          PROFANITY: {},
          THREAT: {},
        },
      }),
    });

    if (response.ok) {
      const data = await response.json() as any;
      const attributes = data?.attributeScores ?? {};
      const values = ["TOXICITY", "INSULT", "PROFANITY", "THREAT"].map(
        (name) => Number(attributes?.[name]?.summaryScore?.value ?? 0)
      );
      return { blocked: Math.max(...values, 0) >= 0.85, source: "gcp" };
    }
  } catch (err: any) {
    logger.error("[chatModerationProxy] hate speech", err.message);
  }

  return { blocked: localHateSpeech(text), source: "local-fallback" };
}

function localHateSpeech(text: string) {
  const t = text.toLowerCase();
  const hateWords = ["hate", "racist", "bigot", "stupid", "idiot", "trash", "kill", "nazi", "slur", "go back"];
  return hateWords.some((word) => t.includes(word));
}
