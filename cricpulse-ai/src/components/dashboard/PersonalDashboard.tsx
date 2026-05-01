import React, { useEffect, useMemo } from 'react';
import { useMatch } from '../../contexts/MatchContext';
import { useUser } from '../../contexts/UserContext';
import './PersonalDashboard.css';

const TEAMS = ['Ireland', 'United States', 'India', 'Australia', 'England', 'Pakistan', 'South Africa', 'New Zealand'];
const PLAYERS_MAP: Record<string, string[]> = {
  'Ireland': ['Lorcan Tucker', 'Paul Stirling', 'Andy Balbirnie', 'Curtis Campher', 'Simi Singh'],
  'United States': ['Monank Patel', 'Aaron Jones', 'Andries Gous', 'Harmeet Singh', 'Saurabh Netravalkar'],
};

const WinProbBar: React.FC<{ t1: string; t2: string; p1: number }> = ({ t1, t2, p1 }) => (
  <div className="win-prob-bar-container">
    <div className="win-prob-labels">
      <span className="win-prob-team">{t1}</span>
      <span className="win-prob-team">{t2}</span>
    </div>
    <div className="win-prob-bar">
      <div className="win-prob-fill" style={{ width: `${p1}%` }} />
    </div>
    <div className="win-prob-values">
      <span className="win-prob-pct text-green">{p1}%</span>
      <span className="win-prob-pct text-accent">{100 - p1}%</span>
    </div>
  </div>
);

const PersonalDashboard: React.FC = () => {
  const { matchState } = useMatch();
  const { user, updateFavoriteTeam, updateFavoritePlayer } = useUser();
  const { scorecard, currentInnings } = matchState;

  const inn1 = scorecard?.scorecard[0];
  const inn2 = scorecard?.scorecard[1];

  const matchTeams = useMemo(() => {
    return [inn1?.batteamname, inn2?.batteamname].filter(Boolean) as string[];
  }, [inn1?.batteamname, inn2?.batteamname]);

  const teamOptions = useMemo(() => {
    return Array.from(new Set([...matchTeams, ...TEAMS]));
  }, [matchTeams]);

  const matchPlayersByTeam = useMemo(() => {
    if (!scorecard) return {} as Record<string, string[]>;
    return scorecard.scorecard.reduce((acc, innings) => {
      const team = innings.batteamname;
      if (!team) return acc;
      const players = innings.batsman
        .map((b) => b.name)
        .filter(Boolean);
      acc[team] = Array.from(new Set([...(acc[team] ?? []), ...players]));
      return acc;
    }, {} as Record<string, string[]>);
  }, [scorecard]);

  const players =
    matchPlayersByTeam[user.favoriteTeam] ??
    PLAYERS_MAP[user.favoriteTeam] ??
    matchPlayersByTeam[matchTeams[0] ?? ''] ??
    PLAYERS_MAP['Ireland'];

  useEffect(() => {
    if (matchTeams.length === 0) return;
    if (!matchTeams.includes(user.favoriteTeam)) {
      updateFavoriteTeam(matchTeams[0]);
    }
  }, [matchTeams, user.favoriteTeam, updateFavoriteTeam]);

  useEffect(() => {
    if (!players || players.length === 0) return;
    if (!players.includes(user.favoritePlayer)) {
      updateFavoritePlayer(players[0]);
    }
  }, [players, user.favoritePlayer, updateFavoritePlayer]);

  const favPlayerData = currentInnings?.batsman.find(
    (b) => b.name.toLowerCase().includes(user.favoritePlayer.toLowerCase().split(' ').slice(-1)[0].toLowerCase())
  );

  const teamLabel = (full?: string, short?: string, fallback = 'Team') => {
    const f = (full ?? '').trim();
    const s = (short ?? '').trim();
    if (f && f !== 'RR') return f;
    if (s && s !== 'RR') return s;
    return fallback;
  };

  // Win probability (simplified calculation based on scores)
  let winProb1 = 50;
  if (scorecard?.ismatchcomplete) {
    // Ireland won
    winProb1 = inn1?.batteamname === 'Ireland' ? 100 : 0;
  } else if (inn1 && inn2) {
    const target = inn1.score + 1;
    const remaining = target - inn2.score;
    const ballsLeft = (20 - inn2.overs) * 6;
    winProb1 = Math.min(95, Math.max(5, Math.round((remaining / (ballsLeft * 0.12)) * 50)));
  }
  return (
    <div className="dashboard-shell">
      {/* User Profile */}
      <div className="section-card">
        <div className="db-profile">
          <div className="db-avatar">{user.avatar}</div>
          <div className="db-user-info">
            <div className="db-username">{user.username}</div>
            <div className="db-points">
              <span>⭐</span>
              <span>{user.points} pts</span>
            </div>
          </div>
        </div>
        <div className="divider" />
        <div className="db-pref-row">
          <label className="db-pref-label">🏏 Fav Team</label>
          <select
            id="fav-team-select"
            className="db-select"
            value={user.favoriteTeam}
            onChange={(e) => updateFavoriteTeam(e.target.value)}
          >
            {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="db-pref-row" style={{ marginTop: 'var(--space-xs)' }}>
          <label className="db-pref-label">👤 Fav Player</label>
          <select
            id="fav-player-select"
            className="db-select"
            value={user.favoritePlayer}
            onChange={(e) => updateFavoritePlayer(e.target.value)}
          >
            {players.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Favorite Player Stats */}
      {favPlayerData && (
        <div className="section-card">
          <div className="section-header">
            <span className="section-title">⭐ {favPlayerData.name}</span>
            <span className={`badge ${parseFloat(favPlayerData.strkrate) >= 150 ? 'badge-green' : 'badge-blue'}`}>
              SR {favPlayerData.strkrate}
            </span>
          </div>
          <div className="db-stat-grid">
            <div className="db-stat-box">
              <div className="db-stat-val text-yellow">{favPlayerData.runs}</div>
              <div className="db-stat-key">RUNS</div>
            </div>
            <div className="db-stat-box">
              <div className="db-stat-val">{favPlayerData.balls}</div>
              <div className="db-stat-key">BALLS</div>
            </div>
            <div className="db-stat-box">
              <div className="db-stat-val text-accent">{favPlayerData.fours}</div>
              <div className="db-stat-key">4s</div>
            </div>
            <div className="db-stat-box">
              <div className="db-stat-val text-green">{favPlayerData.sixes}</div>
              <div className="db-stat-key">6s</div>
            </div>
          </div>
          {favPlayerData.outdec && (
            <div className="db-dismissal">
              {favPlayerData.outdec === 'not out'
                ? '🏏 Currently batting'
                : `❌ ${favPlayerData.outdec}`}
            </div>
          )}
        </div>
      )}

      {/* Win Probability */}
      {scorecard && (
        <div className="section-card">
          <div className="section-header">
            <span className="section-title">📊 Win Probability</span>
          </div>
          {scorecard.ismatchcomplete ? (
            <div className="match-result-badge">
              🏆 {scorecard.status}
            </div>
          ) : (
            <WinProbBar
              t1={teamLabel(inn1?.batteamname, inn1?.batteamsname, 'T1')}
              t2={teamLabel(inn2?.batteamname, inn2?.batteamsname, 'T2')}
              p1={winProb1}
            />
          )}
        </div>
      )}

      {/* Key Stats */}
      {scorecard && (
        <div className="section-card">
          <div className="section-header">
            <span className="section-title">🔑 Key Stats</span>
          </div>
          <div className="db-key-stats">
            {scorecard.scorecard.map((inn, i) => {
              const topBat = [...inn.batsman].sort((a, b) => b.runs - a.runs)[0];
              const topBowl = [...inn.bowler].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
              return (
                <div key={i} className="db-innings-key">
                  <div className="db-innings-label">{teamLabel(inn.batteamname, inn.batteamsname)} Innings</div>
                  {topBat && (
                    <div className="db-key-item">
                      <span className="db-key-icon">🏆</span>
                      <span>{topBat.name.split(' ').slice(-1)[0]} — {topBat.runs} ({topBat.balls}b)</span>
                    </div>
                  )}
                  {topBowl && topBowl.wickets > 0 && (
                    <div className="db-key-item">
                      <span className="db-key-icon">🎯</span>
                      <span>{topBowl.name.split(' ').slice(-1)[0]} — {topBowl.wickets}/{topBowl.runs}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalDashboard;
