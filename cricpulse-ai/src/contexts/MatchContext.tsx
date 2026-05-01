import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { MatchScorecard, LiveMatchState, Commentary } from '../types/cricket';
import fixtureData from '../fixtures/match.json';

// When CLOUD_FUNCTIONS_BASE_URL is empty string, we're on Firebase Hosting
// and functions are reachable at the same origin via rewrites.
// Only force fixture mode when explicitly set to "true".
const IS_FIXTURE_MODE = process.env.REACT_APP_FIXTURE_MODE === 'true';

// Proxy URL: empty = same origin (Firebase Hosting rewrites)
const BASE_URL = process.env.REACT_APP_CLOUD_FUNCTIONS_BASE_URL ?? '';

// ---- Commentary Generator ----
const generateCommentaries = (scorecard: MatchScorecard): Commentary[] => {
  const comments: Commentary[] = [];
  scorecard.scorecard.forEach((innings, idx) => {
    const team = innings.batteamname;
    comments.push({
      id: `inn-start-${idx}`,
      text: `🏏 ${team} innings begins! ${innings.batsman[0]?.name ?? ''} and ${innings.batsman[1]?.name ?? ''} to open.`,
      type: 'normal',
      timestamp: Date.now() - (idx + 1) * 60000 * 30,
    });

    innings.bowler.forEach((b) => {
      if (b.wickets > 0) {
        comments.push({
          id: `wicket-${idx}-${b.id}`,
          text: `🔴 WICKET! ${b.name} takes ${b.wickets > 1 ? b.wickets + ' wickets' : 'a wicket'} for ${b.runs} in ${b.overs} overs! Economy: ${b.economy}`,
          type: 'wicket',
          timestamp: Date.now() - (idx + 1) * 60000 * 15 + b.id,
        });
      }
    });

    innings.batsman.forEach((bat) => {
      if (bat.runs >= 50) {
        comments.push({
          id: `fifty-${idx}-${bat.id}`,
          text: `⭐ MAGNIFICENT! ${bat.name} reaches ${bat.runs} off ${bat.balls} balls — ${bat.fours} fours, ${bat.sixes} sixes! SR: ${bat.strkrate}`,
          type: 'boundary',
          timestamp: Date.now() - (idx + 1) * 60000 * 10 + bat.id,
        });
      }
    });

    comments.push({
      id: `inn-end-${idx}`,
      text: `📊 ${team} finish: ${innings.score}/${innings.wickets} in ${innings.overs} overs. Run rate: ${innings.runrate}`,
      type: 'normal',
      timestamp: Date.now() - idx * 60000 * 5,
    });
  });

  comments.push({
    id: 'final-result',
    text: `🏆 RESULT: ${scorecard.status}`,
    type: 'normal',
    timestamp: Date.now(),
  });

  return comments.sort((a, b) => a.timestamp - b.timestamp);
};

// ---- Context Types ----
interface MatchContextValue {
  matchState: LiveMatchState;
  commentaries: Commentary[];
  currentInningsIndex: number;
  setCurrentInningsIndex: (i: number) => void;
  addAICommentary: (text: string) => void;
  refreshMatch: () => void;
}

const MatchContext = createContext<MatchContextValue | null>(null);

export const useMatch = () => {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error('useMatch must be inside MatchProvider');
  return ctx;
};

export const MatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [matchState, setMatchState] = useState<LiveMatchState>({
    scorecard: null,
    currentInnings: null,
    isFixtureMode: IS_FIXTURE_MODE,
    isLoading: true,
    lastUpdated: 0,
    matchStatus: '',
  });
  const [commentaries, setCommentaries] = useState<Commentary[]>([]);
  const [currentInningsIndex, setCurrentInningsIndex] = useState(1);
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFixtureData = useCallback(() => {
    const data = fixtureData as MatchScorecard;
    const innings = data.scorecard[currentInningsIndex] ?? data.scorecard[0];
    setMatchState({
      scorecard: data,
      currentInnings: innings,
      isFixtureMode: true,
      isLoading: false,
      lastUpdated: Date.now(),
      matchStatus: data.status,
    });
    setCommentaries(generateCommentaries(data));
  }, [currentInningsIndex]);

  const loadLiveData = useCallback(async () => {
    // BASE_URL is empty on Firebase Hosting (rewrites handle routing)
    // For local dev, set REACT_APP_CLOUD_FUNCTIONS_BASE_URL=http://localhost:4000
    const apiBase = BASE_URL || window.location.origin;
    const matchId = process.env.REACT_APP_MATCH_ID ?? '151976';
    try {
      const res = await fetch(`${apiBase}/matchPoller?matchId=${matchId}`, {
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error ?? `HTTP ${res.status}`);
      }
      const data: MatchScorecard = await res.json();
      if (!data.scorecard || data.scorecard.length === 0) throw new Error('Empty scorecard');
      const innings = data.scorecard[currentInningsIndex] ?? data.scorecard[0];
      setMatchState({
        scorecard: data,
        currentInnings: innings,
        isFixtureMode: false,
        isLoading: false,
        lastUpdated: Date.now(),
        matchStatus: data.status,
      });
      setCommentaries(generateCommentaries(data));
      console.log(`[CricPulse] ✅ Live data loaded from ${apiBase} — ${data.status}`);
    } catch (err) {
      console.warn('[CricPulse] Live API failed:', err);
      setMatchState((prev) => ({
        ...prev,
        isFixtureMode: false,
        isLoading: false,
        lastUpdated: Date.now(),
        matchStatus: 'Live data unavailable. Check backend/API keys and retry.',
      }));
    }
  }, [currentInningsIndex]);

  const refreshMatch = useCallback(() => {
    setMatchState((prev) => ({ ...prev, isLoading: true }));
    if (IS_FIXTURE_MODE) loadFixtureData();
    else loadLiveData();
  }, [loadFixtureData, loadLiveData]);

  // Update current innings when index changes
  useEffect(() => {
    if (matchState.scorecard) {
      const innings = matchState.scorecard.scorecard[currentInningsIndex] ?? matchState.scorecard.scorecard[0];
      setMatchState((prev) => ({ ...prev, currentInnings: innings }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentInningsIndex]);

  // Initial load + polling every 30s for live mode
  useEffect(() => {
    refreshMatch();
    if (!IS_FIXTURE_MODE) {
      refreshRef.current = setInterval(refreshMatch, 30000);
    }
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, []); // eslint-disable-line

  const addAICommentary = useCallback((text: string) => {
    setCommentaries((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}`,
        text: `🤖 AI: ${text}`,
        type: 'ai',
        timestamp: Date.now(),
      },
    ]);
  }, []);

  return (
    <MatchContext.Provider
      value={{
        matchState,
        commentaries,
        currentInningsIndex,
        setCurrentInningsIndex,
        addAICommentary,
        refreshMatch,
      }}
    >
      {children}
    </MatchContext.Provider>
  );
};
