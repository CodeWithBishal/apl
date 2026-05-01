import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================
// Gemini Service — CricPulse AI Co-host
// ============================================================

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY ?? '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const _BASE          = process.env.REACT_APP_CLOUD_FUNCTIONS_BASE_URL ?? '';
const PROXY_URL      = _BASE || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');

const COHOST_SYSTEM_PROMPT = `You are CricPulse, an energetic, witty, and expert AI cricket co-host for IPL and international T20 cricket matches.
Your personality:
- You speak with the enthusiasm of a stadium announcer combined with the deep insight of a retired test captain.
- You use cricket-specific terminology naturally (maiden over, DRS, Duckworth-Lewis, powerplay, death overs, etc.)
- You celebrate boundaries and wickets with appropriate energy — exciting but not over the top.
- You provide quick tactical analysis: "That's a classic yorker — textbook death bowling!"
- You reference player stats and history when relevant to the current situation.
- You engage with fan sentiments — if fans are excited, match that energy!
- Keep responses concise (2-4 sentences max) unless asked for deep analysis.
- Use occasional cricket emojis: 🏏🔴⭐🎯🦅🍀🏆
- Always stay positive and inclusive — cricket is for everyone.
- You are a live co-host, so respond in present tense as if the match is happening now.`;

export interface GeminiMessage {
  role: 'user' | 'model';
  text: string;
}

// Try proxy server → direct API key → service-unavailable message
async function callGeminiAPI(
  messages: GeminiMessage[],
  newUserMessage: string
): Promise<string> {
  // 1. Try proxy server (keeps API key server-side — preferred)
  try {
    const res = await fetch(`${PROXY_URL}/geminiProxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, userMessage: newUserMessage, systemPrompt: COHOST_SYSTEM_PROMPT }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.text) return data.text;
    }
  } catch {
    // Proxy not running — try direct API
  }

  // 2. Try direct Gemini API with client-side key
  if (GEMINI_API_KEY) {
    try {
      const history = messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
      const body = {
        system_instruction: { parts: [{ text: COHOST_SYSTEM_PROMPT }] },
        contents: [...history, { role: 'user', parts: [{ text: newUserMessage }] }],
        generationConfig: { temperature: 0.8, topK: 40, topP: 0.95, maxOutputTokens: 256 },
      };
      const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch {
      // Fall through to demo responses
    }
  }

  return 'Live co-host is unavailable right now. Please verify Gemini key/proxy setup and try again.';
}

// ---- Hook ----
export interface UseCohostReturn {
  messages: GeminiMessage[];
  isThinking: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  sendMessage: (text: string) => Promise<void>;
  toggleVoice: () => void;
  clearHistory: () => void;
}

const INITIAL_MESSAGES: GeminiMessage[] = [
  {
    role: 'model',
    text: 'Welcome to CricPulse! Ask me anything about the live match, player tactics, or momentum shifts. 🏏',
  },
];

export function useCohost(): UseCohostReturn {
  const [messages, setMessages] = useState<GeminiMessage[]>(INITIAL_MESSAGES);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMsg: GeminiMessage = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const reply = await callGeminiAPI(messages, text);
      const aiMsg: GeminiMessage = { role: 'model', text: reply };
      setMessages((prev) => [...prev, aiMsg]);

      // TTS — speak the response
      if ('speechSynthesis' in window) {
        setIsSpeaking(true);
        const utt = new SpeechSynthesisUtterance(reply);
        utt.rate = 1.05;
        utt.pitch = 1.0;
        utt.volume = 1;
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Daniel'));
        if (preferred) utt.voice = preferred;
        utt.onend = () => setIsSpeaking(false);
        synthRef.current = utt;
        window.speechSynthesis.speak(utt);
      }
    } catch (err) {
      console.error('[CricPulse] Gemini error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: 'Sorry, I had a hiccup! Ask me again — cricket waits for no one! 🏏' },
      ]);
    } finally {
      setIsThinking(false);
    }
  }, [messages]);

  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Try Chrome!');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition() as any;
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      sendMessage(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, sendMessage]);

  const clearHistory = useCallback(() => {
    setMessages(INITIAL_MESSAGES);
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return { messages, isThinking, isListening, isSpeaking, sendMessage, toggleVoice, clearHistory };
}
