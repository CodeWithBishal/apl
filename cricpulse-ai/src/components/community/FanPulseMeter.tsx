import React, { useEffect, useRef } from 'react';
import { useUser } from '../../contexts/UserContext';
import { SentimentLabel } from '../../types/cricket';
import './FanPulseMeter.css';

const SENTIMENT_CONFIG: Record<SentimentLabel, { color: string; label: string; emoji: string; glow: string }> = {
  happy:   { color: '#00E676', label: 'HYPED',   emoji: '🔥', glow: 'rgba(0,230,118,0.4)' },
  neutral: { color: '#FFD600', label: 'ENGAGED', emoji: '👀', glow: 'rgba(255,214,0,0.4)' },
  angry:   { color: '#FF3D71', label: 'HEATED',  emoji: '😤', glow: 'rgba(255,61,113,0.4)' },
};

const FanPulseMeter: React.FC = () => {
  const { sentimentScore, overallSentiment } = useUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = SENTIMENT_CONFIG[overallSentiment];

  // Normalize score from -1..1 to 0..100
  const percentage = Math.round((sentimentScore + 1) / 2 * 100);

  // Draw the circular gauge
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) / 2 - 8;

    ctx.clearRect(0, 0, W, H);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Gradient arc
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#FF3D71');
    grad.addColorStop(0.5, '#FFD600');
    grad.addColorStop(1, '#00E676');

    const startAngle = Math.PI * 0.75;
    const endAngle = startAngle + (percentage / 100) * Math.PI * 1.5;

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 16;
    ctx.shadowColor = config.glow;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center text
    ctx.fillStyle = config.color;
    ctx.font = `bold 22px 'Outfit', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${percentage}%`, cx, cy - 6);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `600 10px 'Inter', sans-serif`;
    ctx.fillText('FAN PULSE', cx, cy + 14);
  }, [percentage, config, overallSentiment]);

  return (
    <div className="fanpulse-shell" style={{ '--pulse-color': config.color, '--pulse-glow': config.glow } as React.CSSProperties}>
      <div className="fanpulse-header">
        <span className="section-title">❤️‍🔥 Fan Pulse</span>
        <div className={`fanpulse-state-badge fanpulse-state-${overallSentiment}`}>
          {config.emoji} {config.label}
        </div>
      </div>

      <div className="fanpulse-gauge-container">
        <canvas
          ref={canvasRef}
          width={160}
          height={160}
          className="fanpulse-canvas"
        />
      </div>

      {/* Sentiment scale */}
      <div className="fanpulse-scale">
        <span className="fanpulse-scale-label" style={{ color: '#FF3D71' }}>😤 Angry</span>
        <span className="fanpulse-scale-label" style={{ color: '#FFD600' }}>😐 Neutral</span>
        <span className="fanpulse-scale-label" style={{ color: '#00E676' }}>🔥 Hyped</span>
      </div>
    </div>
  );
};

export default FanPulseMeter;
