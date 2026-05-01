import React, { useState, useRef, useEffect } from 'react';
import { useCohost } from '../../services/geminiService';
import { useMatch } from '../../contexts/MatchContext';
import './CohostAvatar.css';

const WaveformBars: React.FC<{ active: boolean; color?: string }> = ({ active, color = 'var(--neon-blue)' }) => {
  const bars = 12;
  return (
    <div className="waveform-container">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`waveform-bar ${active ? 'waveform-bar--active' : ''}`}
          style={{
            '--delay': `${(i / bars) * 0.8}s`,
            '--color': color,
            '--height': `${20 + Math.sin(i * 0.8) * 15}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

const ThinkingDots: React.FC = () => (
  <div className="thinking-dots">
    <div className="thinking-dot" style={{ '--delay': '0s' } as React.CSSProperties} />
    <div className="thinking-dot" style={{ '--delay': '0.15s' } as React.CSSProperties} />
    <div className="thinking-dot" style={{ '--delay': '0.3s' } as React.CSSProperties} />
  </div>
);

const CohostAvatar: React.FC = () => {
  const { messages, isThinking, isListening, isSpeaking, sendMessage, toggleVoice, clearHistory } = useCohost();
  const { addAICommentary } = useMatch();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isActive = isListening || isSpeaking || isThinking;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    await sendMessage(text);
    // Add AI's last response to commentary
    setTimeout(() => {
      const lastAI = messages.filter((m) => m.role === 'model').slice(-1)[0];
      if (lastAI) addAICommentary(lastAI.text.substring(0, 80) + '...');
    }, 500);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const QUICK_QUESTIONS = [
    'Who won the match?',
    'Best batsman today?',
    'Best bowler?',
    'Key turning point?',
  ];

  const avatarColor = isListening ? 'var(--neon-yellow)'
    : isSpeaking ? 'var(--neon-green)'
    : isThinking ? 'var(--neon-purple)'
    : 'var(--neon-blue)';

  return (
    <div className="cohost-shell">
      {/* Avatar Header */}
      <div className="cohost-header">
        <div className={`cohost-avatar-ring ${isActive ? 'cohost-avatar-ring--active' : ''}`}
             style={{ '--ring-color': avatarColor } as React.CSSProperties}>
          <div className="cohost-avatar-inner">
            <span className="cohost-avatar-emoji">🤖</span>
          </div>
          {isActive && <div className="cohost-ring-pulse" style={{ '--ring-color': avatarColor } as React.CSSProperties} />}
        </div>
        <div className="cohost-header-info">
          <div className="cohost-name">CricPulse <span className="cohost-name-ai">AI</span></div>
          <div className="cohost-status">
            {isListening ? '🎤 Listening...' :
             isSpeaking ? '🔊 Speaking...' :
             isThinking ? '💭 Thinking...' :
             '✅ Ready to answer'}
          </div>
        </div>
        <button id="cohost-clear-btn" className="btn btn-ghost btn-icon" onClick={clearHistory} title="Clear chat">
          🗑️
        </button>
      </div>

      {/* Waveform Visualizer */}
      <div className="cohost-waveform">
        <WaveformBars active={isActive} color={avatarColor} />
      </div>

      {/* Chat Messages */}
      <div className="cohost-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`cohost-msg cohost-msg-${msg.role}`}>
            {msg.role === 'model' && <span className="cohost-msg-avatar">🤖</span>}
            <div className="cohost-msg-bubble">
              {msg.text}
            </div>
            {msg.role === 'user' && <span className="cohost-msg-avatar cohost-msg-user-avatar">👤</span>}
          </div>
        ))}
        {isThinking && (
          <div className="cohost-msg cohost-msg-model">
            <span className="cohost-msg-avatar">🤖</span>
            <div className="cohost-msg-bubble">
              <ThinkingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      <div className="cohost-quick-q">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            id={`quick-q-${q.replace(/\s+/g, '-').toLowerCase()}`}
            className="cohost-q-chip"
            onClick={() => sendMessage(q)}
            disabled={isThinking}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Row */}
      <div className="cohost-input-row">
        <button
          id="cohost-voice-btn"
          className={`cohost-voice-btn ${isListening ? 'cohost-voice-btn--active' : ''}`}
          onClick={toggleVoice}
          title={isListening ? 'Stop listening' : 'Ask by voice'}
          aria-label="Voice input"
        >
          {isListening ? '⏹️' : '🎤'}
          {isListening && <span className="voice-pulse-ring" />}
        </button>
        <input
          id="cohost-text-input"
          className="input cohost-text-input"
          placeholder="Ask me about the match..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKey}
          disabled={isThinking || isListening}
        />
        <button
          id="cohost-send-btn"
          className="btn btn-primary cohost-send-btn"
          onClick={handleSend}
          disabled={!inputText.trim() || isThinking}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default CohostAvatar;
