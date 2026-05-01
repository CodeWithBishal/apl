import React from 'react';
import { useUser } from '../../contexts/UserContext';
import './Leaderboard.css';

const RANK_COLORS = ['var(--neon-yellow)', 'rgba(192,192,192,0.9)', 'rgba(205,127,50,0.9)'];

const Leaderboard: React.FC = () => {
  const { leaderboard } = useUser();

  return (
    <div className="leaderboard-shell">
      <div className="leaderboard-header">
        <span className="section-title">🏆 Fan Leaderboard</span>
        <span className="badge badge-blue">LIVE</span>
      </div>

      <div className="leaderboard-list">
        {leaderboard.map((entry, i) => (
          <div
            key={entry.id}
            className={`lb-entry ${i < 3 ? 'lb-entry-top' : ''}`}
            id={`leaderboard-entry-${i + 1}`}
          >
            <div className="lb-rank" style={{ color: RANK_COLORS[i] ?? 'var(--text-muted)' }}>
              {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
            </div>
            <div className="lb-avatar">{entry.avatar}</div>
            <div className="lb-info">
              <span className="lb-username">{entry.username}</span>
            </div>
            <div className="lb-points">
              <span className="lb-pts-val">{entry.points.toLocaleString()}</span>
              <span className="lb-pts-label">pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
