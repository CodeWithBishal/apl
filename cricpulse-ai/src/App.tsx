import React, { useState } from 'react';
import { MatchProvider, useMatch } from './contexts/MatchContext';
import { UserProvider } from './contexts/UserContext';
import PersonalDashboard from './components/dashboard/PersonalDashboard';
import Scorecard from './components/scorecard/Scorecard';
import CommentaryTicker from './components/scorecard/CommentaryTicker';
import InningsTable from './components/scorecard/InningsTable';
import CohostAvatar from './components/cohost/CohostAvatar';
import FanPulseMeter from './components/community/FanPulseMeter';
import ChatRoom from './components/community/ChatRoom';
import Leaderboard from './components/community/Leaderboard';
import './App.css';

type MobileTab = 'dashboard' | 'match' | 'community';

const FixtureBanner: React.FC = () => (
  <div className="fixture-banner">
    <span>📂</span>
    <span>
      <strong>Demo Mode Active</strong> — Running on pre-recorded fixture data. Set{' '}
      <code>REACT_APP_FIXTURE_MODE=false</code> and configure Cloud Functions for live data.
    </span>
  </div>
);

const AppInner: React.FC = () => {
  const [mobileTab, setMobileTab] = useState<MobileTab>('match');
  const isFixture = process.env.REACT_APP_FIXTURE_MODE === 'true' || !process.env.REACT_APP_CLOUD_FUNCTIONS_BASE_URL;
  const { matchState } = useMatch();
  const innings1 = matchState.scorecard?.scorecard?.[0];
  const innings2 = matchState.scorecard?.scorecard?.[1];
  const seoTitle = matchState.scorecard?.appindex?.seotitle ?? '';
  const seoMatch = seoTitle.match(/-\s*([^,|]+?)\s+vs\s+([^,|]+?)(?:\s+\d|,|\|)/i);
  const normalizeTeam = (full?: string, short?: string, fallback = 'T1') => {
    const f = (full ?? '').trim();
    const s = (short ?? '').trim();
    if (f && f !== 'RR') return f;
    if (s && s !== 'RR') return s;
    return fallback;
  };
  let team1 = normalizeTeam(innings1?.batteamname, innings1?.batteamsname, 'T1');
  let team2 = normalizeTeam(innings2?.batteamname, innings2?.batteamsname, 'T2');
  if (team1 === team2 && seoMatch?.[1] && seoMatch?.[2]) {
    team1 = seoMatch[1].trim();
    team2 = seoMatch[2].trim();
  }

  return (
    <div className="app-shell stadium-bg">
      {/* ---- Navigation Bar ---- */}
      <nav className="app-nav">
        <div className="app-nav-brand">
          <div className="app-nav-logo">🏏</div>
          <span className="app-nav-title">CricPulse AI</span>
        </div>

        <div className="app-nav-meta">
          <span className="live-dot" />
          <span>{team1} vs {team2}</span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span>T20I</span>
        </div>

        <div className="app-nav-actions">
          <span className="badge badge-live">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon-red)', display: 'inline-block' }} />
            LIVE
          </span>
        </div>
      </nav>

      {/* ---- Main Content ---- */}
      <main className="app-content">
        {/* ===== LEFT RAIL — Dashboard ===== */}
        <aside className={`rail ${mobileTab === 'dashboard' ? 'rail-mobile-visible' : ''}`}>
          {isFixture && <FixtureBanner />}
          <PersonalDashboard />
        </aside>

        {/* ===== CENTER — Match & Co-host ===== */}
        <section className={`rail-center ${mobileTab === 'match' ? 'rail-mobile-visible' : ''}`}>
          {isFixture && <FixtureBanner />}
          <Scorecard />
          <CohostAvatar />
          <CommentaryTicker />
          <InningsTable />
        </section>

        {/* ===== RIGHT RAIL — Community ===== */}
        <aside className={`rail ${mobileTab === 'community' ? 'rail-mobile-visible' : ''}`}>
          <FanPulseMeter />
          <ChatRoom />
          <Leaderboard />
        </aside>
      </main>

      {/* ---- Mobile Tab Bar ---- */}
      <nav className="mobile-tabs">
        {([
          { id: 'dashboard', icon: '📊', label: 'Dashboard' },
          { id: 'match', icon: '🏏', label: 'Match' },
          { id: 'community', icon: '💬', label: 'Community' },
        ] as { id: MobileTab; icon: string; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            id={`mobile-tab-${tab.id}`}
            className={`mobile-tab ${mobileTab === tab.id ? 'active' : ''}`}
            onClick={() => setMobileTab(tab.id)}
          >
            <span className="mobile-tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

const App: React.FC = () => (
  <MatchProvider>
    <UserProvider>
      <AppInner />
    </UserProvider>
  </MatchProvider>
);

export default App;
