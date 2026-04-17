import { useEffect, useState, useRef } from 'react';
import {
  Plus, Trash2, MessagesSquare, Sparkles, Send, ChevronDown,
  BookOpen, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import useChatStore from '../stores/chatStore';
import useCourseStore from '../stores/courseStore';
import ChatMessage from '../components/chat/ChatMessage';
import ChatPreferencesBar from '../components/chat/ChatPreferencesBar';
import Spinner from '../components/ui/Spinner';
import useStudySessionTracker from '../utils/useStudySessionTracker';
import { readChatPreferences, writeChatPreferences } from '../utils/chatPreferences';

const COACH_MODE_OPTIONS = [
  { value: 'learn', label: 'Learn Concept' },
  { value: 'exam', label: 'Exam Prep' },
  { value: 'assignment', label: 'Assignment Help' },
  { value: 'summary', label: 'Quick Summary' },
  { value: 'practice', label: 'Practice Me' },
];

const COACH_ACTIONS = [
  'Turn into notes',
  'Generate quiz',
  'Make flashcards',
  'Save to revision list',
  'Mark as weak topic',
];

const isDocumentSession = (title = '') => typeof title === 'string' && title.startsWith('DOC::');
const isCoachSession = (title = '') => !isDocumentSession(title);
const stripCoachPrefix = (title = '') => {
  if (typeof title !== 'string') return 'Study Session';
  if (!title.startsWith('COACH::')) return title || 'Study Session';
  const clean = title.slice('COACH::'.length).trim();
  return clean || 'Study Session';
};

const ChatPage = () => {
  const {
    sessions, activeSessionId, messages, sending,
    loadingSessions, loadingMessages,
    fetchSessions, createSession, selectSession, deleteSession, sendMessage,
  } = useChatStore();

  const { semesters, courses, fetchSemesters, fetchCourses } = useCourseStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [text, setText] = useState('');
  const [preferences, setPreferences] = useState(() => readChatPreferences('assistant'));
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const normalizedMode = preferences.responseMode === 'assignment' ? 'learn' : preferences.responseMode;

  const starterPrompts = {
    learn: [
      { q: 'Teach me this topic from beginner level', icon: '🧠' },
      { q: 'Explain this like I have 5 minutes before class', icon: '⏱️' },
      { q: 'What should I understand first before diving deeper?', icon: '🎯' },
      { q: 'Give one real-world example for this concept', icon: '🧪' },
    ],
    summary: [
      { q: 'Create a 2-minute recap of this course', icon: '⚡' },
      { q: 'Summarize the most important points from my uploads', icon: '📝' },
      { q: 'Give a quick revision sheet with key terms', icon: '📚' },
      { q: 'List only what I must remember for exam', icon: '📌' },
    ],
    exam: [
      { q: 'Generate an exam-focused revision plan for this week', icon: '📅' },
      { q: 'Find important exam topics from my uploads', icon: '🔥' },
      { q: 'Give me viva-style answers from my course materials', icon: '🎤' },
      { q: 'Test me on high-priority exam areas', icon: '🧷' },
    ],
    practice: [
      { q: 'Generate practice questions and wait for my answers', icon: '📋' },
      { q: 'Quiz me step by step and score me at the end', icon: '❓' },
      { q: 'Ask 5 short questions from my materials', icon: '🧩' },
      { q: 'Check my understanding and tell weak areas', icon: '✅' },
    ],
  }[normalizedMode];

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

  const coachSessions = sessions.filter((s) => isCoachSession(s.title));

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

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (event) => {
      setIsMobile(event.matches);
      if (event.matches) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    onChange(mq);
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  useEffect(() => {
    writeChatPreferences('assistant', preferences);
  }, [preferences]);

  const handleNewSession = async () => {
    if (!selectedCourse && allCourses.length > 0) {
      setSelectedCourse(allCourses[0].id);
    }
    const courseId = selectedCourse || allCourses[0]?.id;
    if (!courseId) return;
    await createSession(courseId, 'COACH::New Study Session');
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const currentSession = coachSessions.find((s) => s.id === activeSessionId);

    if (!currentSession) {
      const courseId = selectedCourse || allCourses[0]?.id;
      if (!courseId) return;
      const result = await createSession(courseId, `COACH::${trimmed.slice(0, 50)}`);
      if (!result.success) return;
    }

    setText('');
    await sendMessage(trimmed, null, {
      ...preferences,
      responseMode: normalizedMode,
      retrievalScope: 'whole_course',
    });
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeSession = coachSessions.find((s) => s.id === activeSessionId);
  const activeCourseInfo = allCourses.find((c) => c.id === activeSession?.course_id);

  useStudySessionTracker({
    enabled: Boolean(activeSessionId),
    courseId: activeSession?.course_id || selectedCourse || null,
    documentId: null,
    sessionType: 'chat',
  });

  return (
    <div className="flex relative" style={{ height: 'calc(100vh - 64px)' }}>
      {isMobile && sidebarOpen && (
        <button
          className="absolute inset-0 z-20 bg-slate-900/30"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close chat sidebar"
        />
      )}

      {/* Sessions Sidebar */}
      <div
        className={`border-r border-slate-200 flex flex-col transition-all duration-300 ${
          isMobile
            ? `absolute inset-y-0 left-0 z-30 w-[84%] max-w-xs bg-white shadow-xl ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `bg-white ${sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-800">Study Workspaces</h2>
            <button
              onClick={handleNewSession}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition"
              title="New chat"
            >
              <Plus size={16} />
            </button>
          </div>

          <p className="text-[10px] text-slate-400 mb-3">
            Course-level planning, revision, and practice sessions.
          </p>

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
          ) : coachSessions.length === 0 ? (
            <div className="text-center py-8">
              <MessagesSquare size={24} className="text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No Study Coach sessions yet</p>
              <p className="text-xs text-slate-400 mt-1">Start one to plan, revise, or practice</p>
            </div>
          ) : (
            coachSessions.map((s) => (
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
                  {stripCoachPrefix(s.title)}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.id);
                  }}
                  className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 text-slate-300 hover:text-rose-500 ml-2 transition shrink-0"
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
        <div className="h-14 border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <Sparkles size={16} className="text-violet-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {activeSession ? stripCoachPrefix(activeSession.title) : 'Mentora Study Coach'}
            </p>
            {activeCourseInfo && (
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                <BookOpen size={9} />
                {activeCourseInfo.course_code} — {activeCourseInfo.course_name}
              </p>
            )}
          </div>
        </div>

        <ChatPreferencesBar
          preferences={preferences}
          onChange={handlePreferenceChange}
          scopeLabel={selectedCourse ? 'Study Coach is using the selected course context for planning, revision, and practice.' : 'Study Coach can use your course materials and wider context for guidance.'}
          modeOptions={COACH_MODE_OPTIONS}
          renderExtraControls={() => (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 px-1">
                Learning Actions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COACH_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => setText(`${action}: ${text || 'based on my current course context'}`)}
                    className="px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}
        />

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {!activeSession ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-violet-100 to-emerald-100 flex items-center justify-center mb-5">
                <Sparkles size={28} className="text-violet-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Mentora Study Coach</h2>
              <p className="text-sm text-slate-500 max-w-sm mb-8">
                Plan, revise, and practice across your courses with a single Study Coach workspace.
              </p>

              <div className="w-full max-w-3xl mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                {[
                  {
                    title: 'Build a Plan',
                    desc: 'Create a revision timeline and focus topics for this week.',
                    cta: 'Create my 7-day revision plan',
                  },
                  {
                    title: 'Run Practice',
                    desc: 'Generate quizzes and track where you are weak.',
                    cta: 'Test me on this course now',
                  },
                  {
                    title: 'Assignment Support',
                    desc: 'Get outline + key points for assignments using your materials.',
                    cta: 'Help me draft assignment structure',
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    onClick={() => setText(item.cta)}
                    className="rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-200 hover:bg-emerald-50/50 transition"
                  >
                    <p className="text-sm font-semibold text-slate-800 mb-1">{item.title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {starterPrompts.map(({ q, icon }) => (
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
              <p className="text-sm text-slate-400">Send a message to start your study workflow</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onFollowUpClick={(prompt) => {
                    setText(prompt);
                  }}
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

        {/* Message Input */}
        <div className="border-t border-slate-200 p-3 sm:p-4 shrink-0">
          <div className="flex gap-2 sm:gap-3 items-end max-w-4xl mx-auto">
            <textarea
              ref={textareaRef}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition bg-slate-50 focus:bg-white min-h-12 max-h-35"
              placeholder="Ask your study coach to explain, summarize, or quiz you..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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
