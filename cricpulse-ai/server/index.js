// =====================================================================
// CricPulse AI — Local Dev Proxy Server
// Securely wraps: Cricbuzz RapidAPI, Gemini API, Natural Language API
// Run: cd server && npm install && node index.js
// =====================================================================

require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

const app  = express();
const PORT = process.env.PROXY_PORT || 4000;

// Parse JSON bodies for POST requests
app.use(express.json());

// Allow React dev server (port 3000) to call us
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'OPTIONS'],
}));

// =====================================================================
// ENV — read from ../.env (parent directory)
// =====================================================================
const RAPIDAPI_KEY         = process.env.RAPIDAPI_KEY        ?? '';
const RAPIDAPI_HOST        = 'cricbuzz-cricket.p.rapidapi.com';
const GEMINI_API_KEY       = process.env.REACT_APP_GEMINI_API_KEY ?? '';
const GCP_NL_API_KEY       = process.env.GCP_NL_API_KEY      ?? process.env.REACT_APP_GCP_NL_API_KEY ?? '';
const GCP_MODERATION_API_KEY = process.env.GCP_MODERATION_API_KEY ?? GCP_NL_API_KEY;

// =====================================================================
// Health check
// =====================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rapidapi: !!RAPIDAPI_KEY,
    gemini:   !!GEMINI_API_KEY,
    nlApi:    !!GCP_NL_API_KEY,
    moderationApi: !!GCP_MODERATION_API_KEY,
    time: new Date().toISOString(),
  });
});

// =====================================================================
// GET /matchPoller — Fetch live scorecard from Cricbuzz RapidAPI
// Query params: matchId (required)
// =====================================================================
app.get('/matchPoller', async (req, res) => {
  const matchId = req.query.matchId || process.env.REACT_APP_MATCH_ID || '151976';

  if (!RAPIDAPI_KEY) {
    console.warn('[matchPoller] RAPIDAPI_KEY not set — returning fixture data hint');
    return res.status(503).json({
      error: 'RAPIDAPI_KEY not configured. Set it in cricpulse-ai/.env as RAPIDAPI_KEY=your_key',
      hint:  'Set REACT_APP_FIXTURE_MODE=true in .env to use demo data instead.',
    });
  }

  try {
    const url = `https://${RAPIDAPI_HOST}/mcenter/v1/${matchId}/scard`;
    console.log(`[matchPoller] Fetching: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'X-RapidAPI-Key':  RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
      timeout: 10000,
    });

    const raw = response.data;

    // ---- Transform to our MatchScorecard schema ----
    // Cricbuzz returns: { scorecard: [...], matchHeader: {...}, ... }
    // Our schema expects: { scorecard: [...], ismatchcomplete, status, appindex, responselastupdated }
    const transformed = {
      scorecard: raw.scorecard ?? [],
      ismatchcomplete: raw.matchHeader?.state === 'complete' || raw.matchHeader?.complete === true,
      status: raw.matchHeader?.status ?? raw.status ?? 'Match in Progress',
      appindex: {
        seotitle: raw.matchHeader?.matchDescription ?? `Match ${matchId}`,
        weburl:   `https://www.cricbuzz.com/live-cricket-scorecard/${matchId}`,
      },
      responselastupdated: Math.floor(Date.now() / 1000),
    };

    console.log(`[matchPoller] ✅ Score: ${transformed.status}`);
    res.json(transformed);
  } catch (err) {
    const status = err.response?.status ?? 500;
    console.error(`[matchPoller] ❌ Error ${status}:`, err.message);

    // Return a useful error — client will auto-fallback to fixture mode
    res.status(status).json({
      error:   err.message,
      matchId,
      hint:    'Check your RAPIDAPI_KEY and matchId. The client will fall back to fixture mode.',
    });
  }
});

// =====================================================================
// GET /liveMatches — Find currently live cricket matches
// =====================================================================
app.get('/liveMatches', async (req, res) => {
  if (!RAPIDAPI_KEY) {
    return res.status(503).json({ error: 'RAPIDAPI_KEY not configured' });
  }
  try {
    const response = await axios.get(`https://${RAPIDAPI_HOST}/matches/v1/live`, {
      headers: {
        'X-RapidAPI-Key':  RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
      timeout: 8000,
    });

    // Extract match list with IDs and team names
    const matches = (response.data.typeMatches ?? [])
      .flatMap((t) => t.seriesMatches ?? [])
      .flatMap((s) => s.seriesAdWrapper?.matches ?? [])
      .map((m) => ({
        id:          m.matchInfo?.matchId,
        description: m.matchInfo?.matchDesc,
        team1:       m.matchInfo?.team1?.teamName,
        team2:       m.matchInfo?.team2?.teamName,
        status:      m.matchInfo?.status,
        format:      m.matchInfo?.matchFormat,
        venue:       m.matchInfo?.venueInfo?.ground,
      }));

    res.json({ matches, total: matches.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// POST /sentimentProxy — Analyze chat message sentiment
// Body: { text: string }
// Returns: { score: number, magnitude: number, label: 'happy'|'neutral'|'angry' }
// =====================================================================
app.post('/sentimentProxy', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  // If no GCP NL API key, use a lightweight rule-based fallback
  if (!GCP_NL_API_KEY) {
    const score = simpleSentiment(text);
    const label = score > 0.2 ? 'happy' : score < -0.2 ? 'angry' : 'neutral';
    return res.json({ score, magnitude: Math.abs(score), label, source: 'local' });
  }

  try {
    const url = `https://language.googleapis.com/v1/documents:analyzeSentiment?key=${GCP_NL_API_KEY}`;
    const response = await axios.post(url, {
      document: { type: 'PLAIN_TEXT', content: text },
      encodingType: 'UTF8',
    });

    const { score, magnitude } = response.data.documentSentiment;
    const label = score > 0.2 ? 'happy' : score < -0.2 ? 'angry' : 'neutral';
    res.json({ score, magnitude, label, source: 'gcp-nl' });
  } catch (err) {
    console.error('[sentimentProxy] GCP NL error:', err.message);
    // Fallback to local
    const score = simpleSentiment(text);
    const label = score > 0.2 ? 'happy' : score < -0.2 ? 'angry' : 'neutral';
    res.json({ score, magnitude: Math.abs(score), label, source: 'local-fallback' });
  }
});

// =====================================================================
// POST /chatModerationProxy — Sentiment, language and hate-speech checks
// Body: { text: string }
// Returns: { allowed, reason?, language, sentimentScore, sentimentLabel, source }
// =====================================================================
app.post('/chatModerationProxy', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const sentiment = await analyzeSentiment(text);
  const language = await detectLanguage(text);
  const hateSpeech = await detectHateSpeech(text);

  if (hateSpeech.blocked) {
    return res.json({
      allowed: false,
      reason: 'Hate speech recognised.',
      language,
      sentimentScore: sentiment.score,
      sentimentLabel: sentiment.label,
      source: hateSpeech.source,
    });
  }

  res.json({
    allowed: true,
    reason: null,
    language,
    sentimentScore: sentiment.score,
    sentimentLabel: sentiment.label,
    source: sentiment.source,
  });
});

// =====================================================================
// POST /geminiProxy — Secure Gemini API proxy
// Body: { messages: [{role, text}], userMessage: string, systemPrompt?: string }
// =====================================================================
app.post('/geminiProxy', async (req, res) => {
  const { messages = [], userMessage, systemPrompt } = req.body;
  if (!userMessage) return res.status(400).json({ error: 'userMessage is required' });

  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      ...(systemPrompt ? { system_instruction: { parts: [{ text: systemPrompt }] } } : {}),
      contents: [
        ...messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: userMessage }] },
      ],
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 256,
      },
    };

    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    });

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Let me think...';
    res.json({ text });
  } catch (err) {
    console.error('[geminiProxy] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// Simple rule-based sentiment (used when GCP NL key not available)
// =====================================================================
function simpleSentiment(text) {
  const t = text.toLowerCase();
  const positiveWords = ['great','amazing','brilliant','fire','wow','excellent','fantastic',
    'wicket','six','four','boundary','win','champion','love','awesome','best','incredible',
    '🔥','💯','❤️','⭐','🏆','🎯'];
  const negativeWords = ['terrible','awful','bad','worst','hate','horrible','rubbish',
    'useless','pathetic','disgrace','boring','slow','poor','fail','😤','😡'];
  let score = 0;
  positiveWords.forEach(w => { if (t.includes(w)) score += 0.25; });
  negativeWords.forEach(w => { if (t.includes(w)) score -= 0.35; });
  return Math.max(-1, Math.min(1, score));
}

async function analyzeSentiment(text) {
  if (!GCP_NL_API_KEY) {
    const score = simpleSentiment(text);
    const label = score > 0.2 ? 'happy' : score < -0.2 ? 'angry' : 'neutral';
    return { score, magnitude: Math.abs(score), label, source: 'local' };
  }

  try {
    const url = `https://language.googleapis.com/v1/documents:analyzeSentiment?key=${GCP_NL_API_KEY}`;
    const response = await axios.post(url, {
      document: { type: 'PLAIN_TEXT', content: text },
      encodingType: 'UTF8',
    });

    const { score, magnitude } = response.data.documentSentiment;
    const label = score > 0.2 ? 'happy' : score < -0.2 ? 'angry' : 'neutral';
    return { score, magnitude, label, source: 'gcp-nl' };
  } catch (err) {
    console.error('[sentimentProxy] GCP NL error:', err.message);
    const score = simpleSentiment(text);
    const label = score > 0.2 ? 'happy' : score < -0.2 ? 'angry' : 'neutral';
    return { score, magnitude: Math.abs(score), label, source: 'local-fallback' };
  }
}

async function detectLanguage(text) {
  if (!GCP_MODERATION_API_KEY) return 'en';

  try {
    const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${GCP_MODERATION_API_KEY}`;
    const response = await axios.post(url, { q: text }, { timeout: 8000 });
    return response.data?.data?.detections?.[0]?.[0]?.language || 'en';
  } catch (err) {
    console.error('[chatModerationProxy] language detect error:', err.message);
    return 'en';
  }
}

async function detectHateSpeech(text) {
  if (!GCP_MODERATION_API_KEY) {
    return { blocked: localHateSpeech(text), source: 'local' };
  }

  try {
    const url = `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${GCP_MODERATION_API_KEY}`;
    const response = await axios.post(url, {
      comment: { text },
      languages: ['en'],
      requestedAttributes: {
        TOXICITY: {},
        INSULT: {},
        PROFANITY: {},
        THREAT: {},
      },
    }, { timeout: 8000 });

    const attributes = response.data?.attributeScores ?? {};
    const values = ['TOXICITY', 'INSULT', 'PROFANITY', 'THREAT']
      .map((name) => Number(attributes?.[name]?.summaryScore?.value ?? 0));
    const maxScore = Math.max(...values, 0);
    return { blocked: maxScore >= 0.85, source: 'gcp' };
  } catch (err) {
    console.error('[chatModerationProxy] hate speech error:', err.message);
    return { blocked: localHateSpeech(text), source: 'local-fallback' };
  }
}

function localHateSpeech(text) {
  const t = text.toLowerCase();
  const hateWords = ['hate','racist','bigot','stupid','idiot','trash','kill','nazi','slur','go back'];
  return hateWords.some((word) => t.includes(word));
}

// =====================================================================
// Start
// =====================================================================
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║  🏏 CricPulse AI — Proxy Server v1.0    ║
║  Listening on http://localhost:${PORT}       ║
╠══════════════════════════════════════════╣
║  GET  /health          — Status check   ║
║  GET  /matchPoller     — Live scorecard ║
║  GET  /liveMatches     — Active matches ║
║  POST /sentimentProxy  — NL Sentiment   ║
║  POST /chatModerationProxy — Moderation  ║
║  POST /geminiProxy     — Gemini AI      ║
╠══════════════════════════════════════════╣
║  RapidAPI key: ${RAPIDAPI_KEY ? '✅ SET' : '❌ NOT SET — set RAPIDAPI_KEY in .env'}
║  Gemini key:   ${GEMINI_API_KEY ? '✅ SET' : '❌ NOT SET'}
║  GCP NL key:   ${GCP_NL_API_KEY ? '✅ SET' : '⚠️  Not set — using local sentiment'}
╚══════════════════════════════════════════╝
  `);
});
