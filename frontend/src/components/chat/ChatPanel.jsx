import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, MessagesSquare, ChevronDown, Sparkles } from 'lucide-react';
import useChatStore from '../../stores/chatStore';
import ChatMessage from './ChatMessage';
import MessageComposer from './MessageComposer';
import Spinner from '../ui/Spinner';

const CHAT_SESSION_KEY = 'mentora-chat-session-map';

const readSessionMap = () => {
  try {
    const raw = localStorage.getItem(CHAT_SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeSessionMap = (nextMap) => {
  try {
    localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(nextMap));
  } catch {
    // Ignore storage errors to keep chat functional.
  }
};

const ChatPanel = ({ courseId, documentId, documentName, onCitationClick }) => {
  const {
    sessions, activeSessionId, messages, sending,
    loadingSessions, loadingMessages,
    fetchSessions, createSession, selectSession, deleteSession, sendMessage, clearMessages,
  } = useChatStore();

  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef(null);
  const sessionPrefix = documentId ? `DOC::${documentId}::` : '';

  const formatSessionTitle = (rawTitle) => {
    if (!documentId || typeof rawTitle !== 'string') return rawTitle || 'AI Chat';
    if (!rawTitle.startsWith(sessionPrefix)) return rawTitle || 'AI Chat';
    const clean = rawTitle.slice(sessionPrefix.length).trim();
    return clean || 'AI Chat';
  };

  const documentSessions = documentId
    ? sessions.filter((s) => (s.title || '').startsWith(sessionPrefix))
    : sessions;

  useEffect(() => {
    fetchSessions(courseId);
  }, [courseId, fetchSessions]);

  useEffect(() => {
    // Prevent session bleed when navigating between documents in the same course.
    clearMessages();
    setShowSessions(false);
  }, [documentId, clearMessages]);

  useEffect(() => {
    if (!documentId || loadingSessions) return;

    const activeInCurrentDocument = documentSessions.some((s) => s.id === activeSessionId);
    if (activeInCurrentDocument) return;

    const sessionMap = readSessionMap();
    const savedSessionId = sessionMap[documentId];
    const preferredSession = savedSessionId
      ? documentSessions.find((s) => s.id === savedSessionId)
      : null;
    const fallbackSession = documentSessions[0];

    if (preferredSession?.id) {
      selectSession(preferredSession.id);
      return;
    }

    if (fallbackSession?.id) {
      selectSession(fallbackSession.id);
    }
  }, [documentId, documentSessions, activeSessionId, loadingSessions, selectSession]);

  useEffect(() => {
    if (!documentId || !activeSessionId) return;
    if (!documentSessions.some((s) => s.id === activeSessionId)) return;

    const sessionMap = readSessionMap();
    if (sessionMap[documentId] === activeSessionId) return;
    writeSessionMap({ ...sessionMap, [documentId]: activeSessionId });
  }, [documentId, activeSessionId, documentSessions]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewSession = async () => {
    const title = documentId ? `${sessionPrefix}${documentName}` : `Chat: ${documentName}`;
    await createSession(courseId, title);
    setShowSessions(false);
  };

  const handleSend = async (content) => {
    if (!activeSessionId) {
      // Auto-create session on first message
      const baseTitle = content.slice(0, 50);
      const title = documentId ? `${sessionPrefix}${baseTitle}` : baseTitle;
      const result = await createSession(courseId, title);
      if (!result.success) return;
    }
    await sendMessage(content, documentId ? [documentId] : null);
  };

  const activeSession = documentSessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="chat-header">
        <div className="relative flex-1 min-w-0">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-emerald-700 transition min-w-0"
          >
            <Sparkles size={16} className="text-violet-500 shrink-0" />
            <span className="truncate">
              {formatSessionTitle(activeSession?.title) || 'AI Chat'}
            </span>
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
          </button>

          {/* Session dropdown */}
          {showSessions && (
            <div className="absolute top-10 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20 animate-scale-in overflow-hidden">
              <div className="p-2 border-b border-slate-100">
                <button
                  onClick={handleNewSession}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                >
                  <Plus size={14} /> New Chat
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto p-1">
                {loadingSessions ? (
                  <div className="flex justify-center py-4">
                    <Spinner size="sm" />
                  </div>
                ) : documentSessions.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No chat sessions yet</p>
                ) : (
                  documentSessions.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between group px-3 py-2 rounded-lg cursor-pointer transition ${
                        s.id === activeSessionId
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <button
                        onClick={() => {
                          selectSession(s.id);
                          setShowSessions(false);
                        }}
                        className="text-sm truncate flex-1 text-left"
                      >
                        {formatSessionTitle(s.title)}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(s.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 ml-2 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleNewSession}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition shrink-0"
          title="New chat"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages" onClick={() => setShowSessions(false)}>
        {!activeSessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-violet-100 to-emerald-100 flex items-center justify-center mb-4">
              <Sparkles size={24} className="text-violet-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-2">Ask about this document</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-60">
              I can answer questions, summarize content, and explain concepts from your uploaded PDF.
            </p>
            <div className="space-y-2 w-full max-w-65">
              {['Summarize this document', 'Explain the key concepts', 'What are the main findings?'].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : loadingMessages ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <MessagesSquare size={32} className="text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">Send a message to start chatting</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onCitationClick={onCitationClick}
              />
            ))}
            {sending && (
              <div className="chat-msg assistant">
                <div className="chat-msg-avatar">✨</div>
                <div className="chat-msg-bubble">
                  <div className="typing-dots">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Composer */}
      <MessageComposer onSend={handleSend} disabled={sending} />
    </div>
  );
};

export default ChatPanel;
