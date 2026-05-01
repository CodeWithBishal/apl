import React, { useRef, useEffect, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { ChatMessage } from '../../types/cricket';
import './ChatRoom.css';

const MessageBubble: React.FC<{ msg: ChatMessage; isOwn: boolean }> = ({ msg, isOwn }) => {
  const isSystem = msg.userId === 'system';
  const sentimentBorder =
    isSystem ? 'rgba(255,61,113,0.35)' :
    msg.sentiment === 'happy' ? 'rgba(0,230,118,0.3)' :
    msg.sentiment === 'angry' ? 'rgba(255,61,113,0.3)' :
    'transparent';

  return (
    <div className={`chat-msg ${isOwn ? 'chat-msg-own' : ''} ${isSystem ? 'chat-msg-system' : ''}`}>
      {!isOwn && <span className="chat-msg-avatar">{msg.avatar}</span>}
      <div className="chat-msg-body">
        {!isOwn && <span className="chat-msg-username">{msg.username}</span>}
        <div
          className="chat-msg-bubble"
          style={{ borderColor: sentimentBorder }}
        >
          {msg.text}
        </div>
        <span className="chat-msg-time">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {isOwn && <span className="chat-msg-avatar chat-msg-avatar-own">{msg.avatar}</span>}
    </div>
  );
};

const ChatRoom: React.FC = () => {
  const { messages, sendMessage, user, overallSentiment, lastModeration } = useUser();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const onlineCount = Math.max(
    1,
    new Set(messages.map((m) => m.userId).filter((id) => id && id !== 'system')).size
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const chatBorderColor =
    overallSentiment === 'happy' ? 'rgba(0,230,118,0.25)' :
    overallSentiment === 'angry' ? 'rgba(255,61,113,0.25)' :
    'rgba(255,214,0,0.15)';

  const SUGGESTIONS = ['🔥 FIRE!', '💪 Let\'s go!', 'What a catch!', 'OUT! 😤'];

  return (
    <div className="chatroom-shell" style={{ borderColor: chatBorderColor }}>
      <div className="chatroom-header">
        <div className="chatroom-header-copy">
          <span className="section-title">💬 Fan Chat</span>
          <span className="chatroom-moderation-meta">
            GCP sentiment, language and hate-speech checks
          </span>
        </div>
        <span className="chat-user-count">
          <span className="live-dot" /> {onlineCount} online
        </span>
      </div>

      <div className={`chatroom-moderation-pill ${lastModeration?.allowed === false ? 'chatroom-moderation-pill-alert' : ''}`}>
        <span>
          {lastModeration?.allowed === false
            ? lastModeration.reason ?? 'Hate speech recognised.'
            : `Language ${lastModeration?.language?.toUpperCase() ?? 'auto'} · ${lastModeration?.sentimentLabel ?? 'neutral'}`}
        </span>
        {lastModeration?.source && <span className="chatroom-moderation-source">{lastModeration.source}</span>}
      </div>

      {/* Messages */}
      <div className="chatroom-messages" id="chatroom-messages">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} isOwn={msg.userId === 'me'} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      <div className="chat-suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            className="chat-suggestion-chip"
            onClick={() => sendMessage(s)}
            id={`chat-suggest-${s.replace(/[^a-z]/gi, '')}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="chatroom-input-row">
        <span className="chat-input-avatar">{user.avatar}</span>
        <input
          id="chat-message-input"
          className="input chatroom-input"
          placeholder="Share your reaction..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          maxLength={200}
        />
        <button
          id="chat-send-btn"
          className="btn btn-primary chat-send-btn"
          onClick={handleSend}
          disabled={!input.trim()}
          aria-label="Send chat message"
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
