import React, { useEffect, useRef, useState } from 'react';
import { useMatch } from '../../contexts/MatchContext';
import './CommentaryTicker.css';

const CommentaryTicker: React.FC = () => {
  const { commentaries } = useMatch();
  const [activeIdx, setActiveIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (commentaries.length === 0) return;
    intervalRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % commentaries.length);
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [commentaries.length]);

  const activeComment = commentaries[activeIdx];

  const typeColor: Record<string, string> = {
    boundary: 'var(--neon-yellow)',
    wicket: 'var(--neon-red)',
    ai: 'var(--neon-blue)',
    normal: 'var(--text-secondary)',
    wide: 'var(--neon-orange)',
    noball: 'var(--neon-orange)',
  };

  return (
    <div className="commentary-ticker">
      <div className="ticker-label">
        <span className="ticker-icon">📡</span>
        <span>LIVE COMMENTARY</span>
      </div>
      <div className="ticker-track">
        <div className="ticker-content" key={activeIdx} style={{ color: typeColor[activeComment?.type ?? 'normal'] ?? 'var(--text-secondary)' }}>
          {activeComment?.text ?? 'Awaiting match data...'}
        </div>
      </div>
      {/* Progress dots */}
      <div className="ticker-dots">
        {commentaries.slice(0, Math.min(commentaries.length, 10)).map((_, i) => (
          <div
            key={i}
            className={`ticker-dot ${i === activeIdx % 10 ? 'active' : ''}`}
            onClick={() => setActiveIdx(i)}
          />
        ))}
      </div>

      {/* Full list (scrollable) */}
      <div className="ticker-full-list">
        {[...commentaries].reverse().slice(0, 8).map((c) => (
          <div key={c.id} className={`ticker-item ticker-item-${c.type}`}>
            <span className="ticker-item-icon">
              {c.type === 'wicket' ? '🔴' : c.type === 'boundary' ? '⭐' : c.type === 'ai' ? '🤖' : '•'}
            </span>
            <span className="ticker-item-text">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentaryTicker;
