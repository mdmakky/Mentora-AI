import { useEffect, useState, useRef } from 'react';
import {
  Plus, Trash2, MessagesSquare, Sparkles, Send, ChevronDown,
  BookOpen, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import useChatStore from '../stores/chatStore';
import useCourseStore from '../stores/courseStore';
import ChatMessage from '../components/chat/ChatMessage';
import Spinner from '../components/ui/Spinner';

const ChatPage = () => {
  const {
    sessions, activeSessionId, messages, sending,
    loadingSessions, loadingMessages,
    fetchSessions, createSession, selectSession, deleteSession, sendMessage,
  } = useChatStore();

  const { semesters, courses, fetchSemesters, fetchCourses } = useCourseStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Load semesters and courses
  useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);

  useEffect(() => {
    semesters.forEach((sem) => {
      if (!courses[sem.id]) fetchCourses(sem.id);
    });
  }, [semesters, courses, fetchCourses]);

  // Flatten courses for selector
  const allCourses = semesters.flatMap((sem) =>
    (courses[sem.id] || []).map((c) => ({ ...c, semesterName: sem.name }))
  );

  // Load sessions when course changes
  useEffect(() => {
    if (selectedCourse) {
      fetchSessions(selectedCourse);
    } else {
      fetchSessions();
    }
  }, [selectedCourse, fetchSessions]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    }
  }, [text]);

  const handleNewSession = async () => {
    if (!selectedCourse && allCourses.length > 0) {
      setSelectedCourse(allCourses[0].id);
    }
    const courseId = selectedCourse || allCourses[0]?.id;
    if (!courseId) return;
    await createSession(courseId, 'New Chat');
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (!activeSessionId) {
      const courseId = selectedCourse || allCourses[0]?.id;
      if (!courseId) return;
      const result = await createSession(courseId, trimmed.slice(0, 50));
      if (!result.success) return;
    }

    setText('');
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeCourseInfo = allCourses.find((c) => c.id === activeSession?.course_id);

  return (
    <div className="flex" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Sessions Sidebar */}
      <div
        className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-800">Chat Sessions</h2>
            <button
              onClick={handleNewSession}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition"
              title="New chat"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Course filter */}
          <select
            value={selectedCourse || ''}
            onChange={(e) => setSelectedCourse(e.target.value || null)}
            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-500 transition bg-white"
          >
            <option value="">All Courses</option>
            {allCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course_code} — {c.course_name}
              </option>
            ))}
          </select>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loadingSessions ? (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <MessagesSquare size={24} className="text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No chat sessions yet</p>
              <p className="text-xs text-slate-400 mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition mb-0.5 ${
                  s.id === activeSessionId
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <button
                  onClick={() => selectSession(s.id)}
                  className="text-xs font-medium truncate flex-1 text-left"
                >
                  {s.title}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 ml-2 transition flex-shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Chat Header */}
        <div className="h-14 border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition flex-shrink-0"
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <Sparkles size={16} className="text-violet-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {activeSession?.title || 'Mentora AI Chat'}
            </p>
            {activeCourseInfo && (
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                <BookOpen size={9} />
                {activeCourseInfo.course_code} — {activeCourseInfo.course_name}
              </p>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!activeSessionId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-emerald-100 flex items-center justify-center mb-5">
                <Sparkles size={28} className="text-violet-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Mentora AI Chat</h2>
              <p className="text-sm text-slate-500 max-w-sm mb-8">
                Ask questions about your course materials. I use your uploaded documents to provide accurate, cited answers.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {[
                  { q: 'Summarize my latest lecture notes', icon: '📝' },
                  { q: 'Explain the key concepts from Chapter 3', icon: '💡' },
                  { q: 'Generate practice questions for the exam', icon: '📋' },
                  { q: 'What are the main findings in my paper?', icon: '🔍' },
                ].map(({ q, icon }) => (
                  <button
                    key={q}
                    onClick={() => {
                      setText(q);
                    }}
                    className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition flex items-start gap-2.5"
                  >
                    <span className="text-base">{icon}</span>
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <MessagesSquare size={36} className="text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">Send a message to start chatting</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
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

        {/* Message Input */}
        <div className="border-t border-slate-200 p-4 flex-shrink-0">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <textarea
              ref={textareaRef}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition bg-slate-50 focus:bg-white min-h-[48px] max-h-[140px]"
              placeholder="Ask about your course materials..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
