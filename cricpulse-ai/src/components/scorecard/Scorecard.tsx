import React, { useEffect, useRef } from 'react';
import { useMatch } from '../../contexts/MatchContext';
import './Scorecard.css';

const Scorecard: React.FC = () => {
  const { matchState, currentInningsIndex, setCurrentInningsIndex } = useMatch();
  const { scorecard, currentInnings, isFixtureMode, matchStatus, isLoading } = matchState;
  const prevScoreRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Detect score changes and trigger animation
  useEffect(() => {
    if (!currentInnings || isLoading) return;
    const prev = prevScoreRef.current;
    const curr = currentInnings.score;
    if (prev !== null && curr !== prev && cardRef.current) {
      const diff = curr - prev;
      if (diff >= 4) {
        cardRef.current.classList.remove('anim-boundary');
        void cardRef.current.offsetWidth;
        cardRef.current.classList.add('anim-boundary');
      }
    }
    prevScoreRef.current = curr;
  }, [currentInnings, isLoading]);

  if (isLoading || !scorecard) {
    return (
      <div className="scorecard-shell">
        <div className="skeleton" style={{ height: '180px', width: '100%' }} />
      </div>
    );
  }

  const innings1 = scorecard.scorecard[0];
  const innings2 = scorecard.scorecard[1];
  const active = currentInnings ?? innings1;

  const parseSeoTeams = (): [string | null, string | null] => {
    const seo = scorecard?.appindex?.seotitle ?? '';
    const m = seo.match(/-\s*([^,|]+?)\s+vs\s+([^,|]+?)(?:\s+\d|,|\|)/i);
    if (!m) return [null, null];
    return [m[1].trim(), m[2].trim()];
  };

  const [seoTeam1, seoTeam2] = parseSeoTeams();
  const normalizeTeam = (full?: string, short?: string): string => {
    const fullName = (full ?? '').trim();
    const shortName = (short ?? '').trim();
    if (fullName && fullName !== 'RR') return fullName;
    if (shortName && shortName !== 'RR') return shortName;
    return fullName || shortName || 'Team';
  };

  let team1Name = normalizeTeam(innings1?.batteamname, innings1?.batteamsname);
  let team2Name = normalizeTeam(innings2?.batteamname, innings2?.batteamsname);

  if (team1Name === team2Name && seoTeam1 && seoTeam2) {
    team1Name = seoTeam1;
    team2Name = seoTeam2;
  }

  const reqRunRate = innings2
    ? ((innings1.score + 1 - innings2.score) / Math.max(1, (20 - innings2.overs))).toFixed(2)
    : null;

  const topBatsman = active.batsman
    .filter((b) => b.runs > 0)
    .sort((a, b) => b.runs - a.runs)[0];

  const topBowler = active.bowler
    .filter((b) => b.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets)[0];

  return (
    <div className="scorecard-shell" ref={cardRef}>
      {/* Match Status */}
      <div className="match-status-bar">
        <span className="match-status-text">{matchStatus}</span>
        {isFixtureMode && (
          <span className="badge badge-yellow" style={{ fontSize: '0.6rem' }}>📂 DEMO</span>
        )}
      </div>

      {/* Innings Tabs */}
      <div className="innings-tabs" style={{ marginBottom: '12px' }}>
        {scorecard.scorecard.map((inn, idx) => (
          <button
            key={idx}
            className={`innings-tab ${currentInningsIndex === idx ? 'active' : ''}`}
            onClick={() => setCurrentInningsIndex(idx)}
            id={`innings-tab-${idx}`}
          >
            {normalizeTeam(inn.batteamname, inn.batteamsname)} {idx + 1}st Inn
          </button>
        ))}
      </div>

      {/* Main Score Display */}
      <div className="score-display">
        <div className="score-team">
          <span className="score-team-name">
            {active.inningsid === innings1?.inningsid ? team1Name : team2Name}
          </span>
          <div className="score-runs-block">
            <span className="score-runs">{active.score}</span>
            <span className="score-sep">/</span>
            <span className="score-wickets">{active.wickets}</span>
          </div>
          <span className="score-overs">({active.overs} ov)</span>
        </div>

        {/* vs divider */}
        <div className="score-vs-divider">
          <div className="score-vs-line" />
          <span className="score-vs-label">vs</span>
          <div className="score-vs-line" />
        </div>

        {/* Other innings */}
        {currentInningsIndex === 1 && innings1 && (
          <div className="score-team score-team-secondary">
            <span className="score-team-name secondary">{team1Name}</span>
            <div className="score-runs-block">
              <span className="score-runs secondary">{innings1.score}</span>
              <span className="score-sep">/</span>
              <span className="score-wickets">{innings1.wickets}</span>
            </div>
            <span className="score-overs secondary">({innings1.overs} ov)</span>
          </div>
        )}

        {currentInningsIndex === 0 && innings2 && (
          <div className="score-team score-team-secondary">
            <span className="score-team-name secondary">{team2Name}</span>
            <div className="score-runs-block">
              <span className="score-runs secondary">{innings2.score}</span>
              <span className="score-sep">/</span>
              <span className="score-wickets">{innings2.wickets}</span>
            </div>
            <span className="score-overs secondary">({innings2.overs} ov)</span>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="score-stats-row">
        <div className="score-stat">
          <span className="score-stat-label">RUN RATE</span>
          <span className="score-stat-value text-accent">{active.runrate}</span>
        </div>
        {reqRunRate && innings2 && !scorecard.ismatchcomplete && (
          <div className="score-stat">
            <span className="score-stat-label">REQ. RR</span>
            <span className="score-stat-value text-yellow">{reqRunRate}</span>
          </div>
        )}
        {topBatsman && (
          <div className="score-stat">
            <span className="score-stat-label">TOP BAT</span>
            <span className="score-stat-value">
              {topBatsman.name.split(' ').slice(-1)[0]} {topBatsman.runs}*
            </span>
          </div>
        )}
        {topBowler && (
          <div className="score-stat">
            <span className="score-stat-label">TOP BWL</span>
            <span className="score-stat-value text-red">
              {topBowler.name.split(' ').slice(-1)[0]} {topBowler.wickets}/{topBowler.runs}
            </span>
          </div>
        )}
      </div>

      {/* Extras */}
      <div className="score-extras">
        <span className="text-muted" style={{ fontSize: '0.72rem' }}>
          Extras: {active.extras.total} (w: {active.extras.wides}, nb: {active.extras.noballs}, lb: {active.extras.legbyes}, b: {active.extras.byes})
        </span>
      </div>
    </div>
  );
};

export default Scorecard;
