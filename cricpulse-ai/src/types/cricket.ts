// ============================================================
// CricPulse AI — Cricket Types (Cricbuzz RapidAPI schema)
// ============================================================

export interface Batsman {
  id: number;
  balls: number;
  runs: number;
  fours: number;
  sixes: number;
  strkrate: string;
  name: string;
  nickname: string;
  iscaptain: boolean;
  iskeeper: boolean;
  outdec: string;
  videotype: string;
  videourl: string;
  videoid: number;
  planid: number;
  imageid: number;
  premiumvideourl: string;
  iscbplusfree: boolean;
  ispremiumfree: boolean;
  inmatchchange: string;
  isoverseas: boolean;
  playingxichange: string;
}

export interface Bowler {
  id: number;
  overs: string;
  maidens: number;
  wickets: number;
  runs: number;
  economy: string;
  name: string;
  nickname: string;
  iscaptain: boolean;
  iskeeper: boolean;
  videotype: string;
  videourl: string;
  videoid: number;
  dots: number;
  balls: number;
  rpb: number;
  planid: number;
  imageid: number;
  premiumvideourl: string;
  ispremiumfree: boolean;
  inmatchchange: string;
  isoverseas: boolean;
  playingxichange: string;
}

export interface FallOfWicket {
  batsmanid: number;
  batsmanname: string;
  overnbr: number;
  runs: number;
  ballnbr: number;
}

export interface Partnership {
  id: number;
  bat1id: number;
  bat1name: string;
  bat1runs: number;
  bat1fours: number;
  bat1sixes: number;
  bat2id: number;
  bat2name: string;
  bat2runs: number;
  bat2fours: number;
  bat2sixes: number;
  totalruns: number;
  totalballs: number;
  bat1balls: number;
  bat2balls: number;
  teamname: string;
  teamid: number;
}

export interface Extras {
  legbyes: number;
  byes: number;
  wides: number;
  noballs: number;
  penalty: number;
  total: number;
}

export interface Innings {
  inningsid: number;
  batsman: Batsman[];
  bowler: Bowler[];
  fow: { fow: FallOfWicket[] };
  extras: Extras;
  score: number;
  wickets: number;
  overs: number;
  runrate: number;
  batteamname: string;
  batteamsname: string;
  isdeclared: boolean;
  isfollowon: boolean;
  ballnbr: number;
  rpb: number;
  partnership: { partnership: Partnership[] };
}

export interface AppIndex {
  seotitle: string;
  weburl: string;
}

export interface MatchScorecard {
  scorecard: Innings[];
  ismatchcomplete: boolean;
  appindex: AppIndex;
  status: string;
  responselastupdated: number;
}

// ============================================================
// App-specific types
// ============================================================

export type SentimentLabel = 'angry' | 'neutral' | 'happy';

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  timestamp: number;
  sentiment?: SentimentLabel;
  sentimentScore?: number;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar: string;
  points: number;
  rank: number;
}

export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  favoriteTeam: string;
  favoritePlayer: string;
  points: number;
}

export interface LiveMatchState {
  scorecard: MatchScorecard | null;
  currentInnings: Innings | null;
  isFixtureMode: boolean;
  isLoading: boolean;
  lastUpdated: number;
  matchStatus: string;
}

export interface Commentary {
  id: string;
  text: string;
  type: 'normal' | 'boundary' | 'wicket' | 'wide' | 'noball' | 'ai';
  timestamp: number;
  over?: number;
}

export interface WinProbability {
  team1: number;
  team2: number;
  team1name: string;
  team2name: string;
}
