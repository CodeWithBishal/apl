import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UserProfile, ChatMessage, SentimentLabel } from '../types/cricket';
import {
  IS_FIREBASE_CONFIGURED,
  sendChatMessage,
  subscribeToChatMessages,
} from '../services/firebase';

const MATCH_ID  = process.env.REACT_APP_MATCH_ID ?? '151976';
// Empty BASE_URL means Firebase Hosting — functions available at same origin via rewrites
const _BASE     = process.env.REACT_APP_CLOUD_FUNCTIONS_BASE_URL ?? '';
const PROXY_URL = _BASE || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');

interface ModerationVerdict {
  allowed: boolean;
  reason?: string;
  language?: string;
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  source?: string;
}

// ---- Demo users for leaderboard ----
const DEMO_USERS: LeaderboardUser[] = [
  { id: '1', username: 'CricketKing',  avatar: '👑', points: 2450, rank: 1 },
  { id: '2', username: 'Kohli_Fan07',  avatar: '🏏', points: 1820, rank: 2 },
  { id: '3', username: 'MS_Dhoni_7',   avatar: '🦁', points: 1600, rank: 3 },
  { id: '4', username: 'IrishCricket', avatar: '🍀', points: 980,  rank: 4 },
  { id: '5', username: 'USACricket',   avatar: '🦅', points: 750,  rank: 5 },
];

export interface LeaderboardUser {
  id: string;
  username: string;
  avatar: string;
  points: number;
  rank: number;
}

interface UserContextValue {
  user: UserProfile;
  messages: ChatMessage[];
  leaderboard: LeaderboardUser[];
  overallSentiment: SentimentLabel;
  sentimentScore: number;
  lastModeration: ModerationVerdict | null;
  isFirebaseEnabled: boolean;
  sendMessage: (text: string) => Promise<void>;
  updateFavoriteTeam: (team: string) => void;
  updateFavoritePlayer: (player: string) => void;
}

const defaultUser: UserProfile = {
  id: 'me',
  username: 'You',
  avatar: '🎉',
  favoriteTeam: 'Ireland',
  favoritePlayer: 'Lorcan Tucker',
  points: 125,
};

const UserContext = createContext<UserContextValue | null>(null);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be inside UserProvider');
  return ctx;
};

// ---- Sentiment and moderation via proxy server (falls back to local) ----
async function moderateChatMessage(text: string): Promise<ModerationVerdict> {
  try {
    const res = await fetch(`${PROXY_URL}/chatModerationProxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        allowed: Boolean(data.allowed),
        reason: data.reason,
        language: data.language,
        sentimentScore: Number(data.sentimentScore ?? 0),
        sentimentLabel: (data.sentimentLabel ?? 'neutral') as SentimentLabel,
        source: data.source,
      };
    }
  } catch {
    // Continue to local fallback
  }

  return localModeration(text);
}

function localSentiment(text: string): { score: number; label: SentimentLabel } {
  const t = text.toLowerCase();
  const positive = ['great', 'amazing', 'brilliant', 'fire', 'wow', 'excellent', 'love', 'awesome', 'wicket', '🔥', '💯', '⭐', '🎯'];
  const negative = ['terrible', 'awful', 'bad', 'worst', 'hate', 'horrible', 'rubbish', 'useless', 'pathetic'];
  let score = 0;
  positive.forEach(w => { if (t.includes(w)) score += 0.3; });
  negative.forEach(w => { if (t.includes(w)) score -= 0.4; });
  score = Math.max(-1, Math.min(1, score));
  const label: SentimentLabel = score > 0.2 ? 'happy' : score < -0.2 ? 'angry' : 'neutral';
  return { score, label };
}

function localModeration(text: string): ModerationVerdict {
  const { score, label } = localSentiment(text);
  const lowered = text.toLowerCase();
  const hateWords = ['hate', 'racist', 'bigot', 'stupid', 'idiot', 'trash', 'kill', 'nazi', 'slur', 'go back'];
  const blocked = hateWords.some((word) => lowered.includes(word));

  return {
    allowed: !blocked,
    reason: blocked ? 'Hate speech recognised.' : undefined,
    language: 'en',
    sentimentScore: score,
    sentimentLabel: label,
    source: 'local',
  };
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leaderboard] = useState<LeaderboardUser[]>(DEMO_USERS);
  const [sentimentScore, setSentimentScore] = useState(0);
  const [lastModeration, setLastModeration] = useState<ModerationVerdict | null>(null);

  // ---- Firestore real-time chat subscription ----
  useEffect(() => {
    if (!IS_FIREBASE_CONFIGURED) return;

    const unsubscribe = subscribeToChatMessages(MATCH_ID, (firestoreMsgs) => {
      const mapped: ChatMessage[] = firestoreMsgs.map((d: any) => ({
        id:             d.id,
        userId:         d.userId,
        username:       d.username,
        avatar:         d.avatar,
        text:           d.text,
        timestamp:      d.timestamp,
        sentiment:      d.sentiment,
        sentimentScore: d.sentimentScore,
      }));
      setMessages(mapped);
      // Update rolling average from latest messages
      const recent = mapped.filter((m) => m.userId !== 'system').slice(-5);
      if (recent.length === 0) {
        setSentimentScore(0);
      } else {
        const avg = recent.reduce((s, m) => s + (m.sentimentScore ?? 0), 0) / recent.length;
        setSentimentScore(avg);
      }
    });

    return unsubscribe;
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const moderation = await moderateChatMessage(text);
    setLastModeration(moderation);

    if (!moderation.allowed) {
      const moderationMsg: ChatMessage = {
        id: `${Date.now()}-moderation`,
        userId: 'system',
        username: 'CricPulse Safety',
        avatar: '🛡️',
        text: moderation.reason ?? 'Hate speech recognised.',
        timestamp: Date.now(),
        sentiment: 'neutral',
        sentimentScore: 0,
      };
      setMessages(prev => [...prev, moderationMsg].slice(-100));
      return;
    }

    const { sentimentScore: score, sentimentLabel: label } = moderation;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      userId: 'me',
      username: user.username,
      avatar: user.avatar,
      text,
      timestamp: Date.now(),
      sentiment: label,
      sentimentScore: score,
    };

    if (IS_FIREBASE_CONFIGURED) {
      // Optimistic local update
      setMessages(prev => [...prev, newMsg].slice(-100));
      // Persist to Firestore
      await sendChatMessage(MATCH_ID, {
        userId:         newMsg.userId,
        username:       newMsg.username,
        avatar:         newMsg.avatar,
        text:           newMsg.text,
        sentiment:      newMsg.sentiment,
        sentimentScore: newMsg.sentimentScore,
      });
    } else {
      // In-memory only
      setMessages(prev => [...prev, newMsg].slice(-100));
    }

    // Update rolling sentiment
    setSentimentScore(prev => prev * 0.7 + score * 0.3);
  }, [user]);

  const overallSentiment: SentimentLabel =
    sentimentScore > 0.2 ? 'happy' : sentimentScore < -0.2 ? 'angry' : 'neutral';

  const updateFavoriteTeam  = useCallback((team: string)   => setUser(p => ({ ...p, favoriteTeam: team })), []);
  const updateFavoritePlayer = useCallback((player: string) => setUser(p => ({ ...p, favoritePlayer: player })), []);

  return (
    <UserContext.Provider
      value={{
        user,
        messages,
        leaderboard,
        overallSentiment,
        sentimentScore,
        lastModeration,
        isFirebaseEnabled: IS_FIREBASE_CONFIGURED,
        sendMessage,
        updateFavoriteTeam,
        updateFavoritePlayer,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
