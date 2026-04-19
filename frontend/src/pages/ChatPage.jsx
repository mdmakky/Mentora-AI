import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Trash2, MessagesSquare, Sparkles, Send,
  BookOpen, PanelLeftClose, PanelLeftOpen, Download, Target, Flame, Pencil, Check, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useChatStore from '../stores/chatStore';
import useCourseStore from '../stores/courseStore';
import useStudyStore from '../stores/studyStore';
import ChatMessage from '../components/chat/ChatMessage';
import ChatPreferencesBar from '../components/chat/ChatPreferencesBar';
import Spinner from '../components/ui/Spinner';
import useStudySessionTracker from '../utils/useStudySessionTracker';
import { readChatPreferences, writeChatPreferences } from '../utils/chatPreferences';
import { apiClient } from '../lib/apiClient';

const COACH_MODE_OPTIONS = [
  { value: 'learn', label: 'Learn Concept' },
  { value: 'exam', label: 'Exam Prep' },
  { value: 'assignment', label: 'Assignment Help' },
  { value: 'summary', label: 'Quick Summary' },
  { value: 'practice', label: 'Practice Me' },
];

// Only real, wired actions — ghost ones removed
const COACH_PROMPT_ACTIONS = [
  { label: 'Generate quiz', prompt: 'Generate a 5-question quiz from my course materials and wait for my answers' },
  { label: 'Make flashcards', prompt: 'Create 8 flashcard-style Q&A pairs from the key concepts in this course' },
  { label: 'Revision bullets', prompt: 'Give me a concise revision bullet-point summary of the most important topics in this course' },
  { label: 'Exam tips', prompt: 'What are the highest-priority topics and likely exam questions from my course materials?' },
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
    fetchSessions, createSession, selectSession, deleteSession, sendMessage, exportSession, renameSession,
  } = useChatStore();

  const { semesters, courses, fetchSemesters, fetchCourses } = useCourseStore();
  const { todayStats, streak, fetchTodayStats, fetchStreak } = useStudyStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 768 : true
  );
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [text, setText] = useState('');
  const [exportingSession, setExportingSession] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [preferences, setPreferences] = useState(() => readChatPreferences('assistant'));
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const renameInputRef = useRef(null);

  // Paper analysis per selected course
  const [paperAnalysis, setPaperAnalysis] = useState(null);
  const [paperAnalysisLoading, setPaperAnalysisLoading] = useState(false);

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
    fetchTodayStats();
  }, [fetchSemesters, fetchTodayStats]);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  useEffect(() => {
    if (!selectedCourse) { setPaperAnalysis(null); return; }
    setPaperAnalysisLoading(true);
    apiClient.get(`/ai/analyze-papers/${selectedCourse}`)
      .then((data) => setPaperAnalysis(data))
      .catch(() => setPaperAnalysis(null))
      .finally(() => setPaperAnalysisLoading(false));
  }, [selectedCourse]);

  // Pre-select course from URL param ?course=<id>
  useEffect(() => {
    const courseParam = searchParams.get('course');
    if (courseParam) setSelectedCourse(courseParam);
  }, [searchParams]);

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
    if (allCourses.length === 0) {
      toast.error('Add a course first before starting a Study Coach session.');
      return;
    }
    if (!selectedCourse && allCourses.length > 0) {
      setSelectedCourse(allCourses[0].id);
    }
    const courseId = selectedCourse || allCourses[0]?.id;
    if (!courseId) return;
    await createSession(courseId, 'COACH::New Study Session');
  };

  const handleCourseChange = (courseId) => {
    setSelectedCourse(courseId || null);
    setSearchParams(courseId ? { course: courseId } : {}, { replace: true });
  };

  const handleStartRename = (session, e) => {
    e.stopPropagation();
    setRenamingSessionId(session.id);
    setRenameValue(stripCoachPrefix(session.title));
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const handleRenameCommit = async (sessionId) => {
    const trimmed = renameValue.trim();
    if (trimmed) await renameSession(sessionId, trimmed);
    setRenamingSessionId(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e, sessionId) => {
    if (e.key === 'Enter') { e.preventDefault(); handleRenameCommit(sessionId); }
    if (e.key === 'Escape') { setRenamingSessionId(null); setRenameValue(''); }
  };

  const handleExportSession = async () => {
    if (!activeSessionId || exportingSession) return;
    setExportingSession(true);
    const result = await exportSession(activeSessionId);
    setExportingSession(false);
    if (result.success && result.data?.content) {
      const blob = new Blob([result.data.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(result.data.title || 'study-session').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Session exported as Markdown');
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (allCourses.length === 0) {
      toast.error('Add a course first before starting a Study Coach session.');
      return;
    }

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

  const handleSendWithText = async (content) => {
    if (!content || !content.trim() || sending) return;
    if (allCourses.length === 0) {
      toast.error('Add a course first before starting a Study Coach session.');
      return;
    }
    const currentSession = coachSessions.find((s) => s.id === activeSessionId);
    if (!currentSession) {
      const courseId = selectedCourse || allCourses[0]?.id;
      if (!courseId) return;
      const result = await createSession(courseId, `COACH::${content.slice(0, 50)}`);
      if (!result.success) return;
    }
    setText('');
    await sendMessage(content.trim(), null, {
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

  const highProbTopics = (paperAnalysis?.repeat_topics || [])
    .filter((t) => t.frequency >= 2)
    .slice(0, 4);

  const formatTime = (mins) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

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
            onChange={(e) => handleCourseChange(e.target.value || null)}
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
                {renamingSessionId === s.id ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameCommit(s.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, s.id)}
                      className="flex-1 min-w-0 text-xs rounded-md border border-emerald-300 bg-white px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                    <button
                      onMouseDown={(e) => { e.preventDefault(); handleRenameCommit(s.id); }}
                      className="text-emerald-500 hover:text-emerald-700 shrink-0"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setRenamingSessionId(null); }}
                      className="text-slate-300 hover:text-slate-500 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => selectSession(s.id)}
                      className="text-xs font-medium truncate flex-1 text-left"
                    >
                      {stripCoachPrefix(s.title)}
                    </button>
                    <div className="flex items-center gap-0.5 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition shrink-0">
                      <button
                        onClick={(e) => handleStartRename(s, e)}
                        className="text-slate-300 hover:text-slate-500 p-0.5"
                        title="Rename"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(s.id);
                        }}
                        className="text-slate-300 hover:text-rose-500 p-0.5"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </>
                )}
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
          <div className="min-w-0 flex-1">
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

          {/* Today's goal progress pill */}
          {todayStats && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 shrink-0" title="Today's study goal progress">
              <Flame size={11} className={todayStats.total_minutes >= todayStats.goal_minutes ? 'text-amber-500' : 'text-slate-400'} />
              <span className="text-[10px] font-semibold text-slate-600">
                {todayStats.total_minutes}
                <span className="text-slate-400 font-normal">/{todayStats.goal_minutes}m</span>
              </span>
              <div className="w-12 h-1 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min((todayStats.total_minutes / todayStats.goal_minutes) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Export button — only shown when a session is active */}
          {activeSession && (
            <button
              onClick={handleExportSession}
              disabled={exportingSession}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0 disabled:opacity-50"
              title="Export session as Markdown"
            >
              {exportingSession ? <Spinner size="sm" /> : <Download size={15} />}
            </button>
          )}
        </div>

        <ChatPreferencesBar
          preferences={preferences}
          onChange={handlePreferenceChange}
          scopeLabel={selectedCourse ? 'Study Coach is using the selected course context for planning, revision, and practice.' : 'Study Coach can use your course materials and wider context for guidance.'}
          modeOptions={COACH_MODE_OPTIONS}
          renderExtraControls={() => (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 px-1">
                Quick Actions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COACH_PROMPT_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => handleSendWithText(action.prompt)}
                    className="px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition"
                  >
                    {action.label}
                  </button>
                ))}
                {activeSession && (
                  <button
                    type="button"
                    onClick={handleExportSession}
                    disabled={exportingSession}
                    className="px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition disabled:opacity-50 flex items-center gap-1"
                  >
                    <Download size={9} />
                    Save as notes
                  </button>
                )}
              </div>
            </div>
          )}
        />

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {!activeSession ? (
            <div className="max-w-2xl mx-auto py-8 sm:py-10 space-y-6">

              {/* Personalized greeting */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-violet-100 to-emerald-100 flex items-center justify-center shrink-0">
                  <Sparkles size={22} className="text-violet-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {streak?.current_streak > 0
                      ? `🔥 ${streak.current_streak}-day streak — keep it going!`
                      : 'Ready to study?'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {todayStats?.total_minutes > 0
                      ? `${formatTime(todayStats.total_minutes)} studied today · Goal: ${formatTime(todayStats.goal_minutes)}`
                      : 'No study time logged today yet — start a session below'}
                  </p>
                </div>
              </div>

              {allCourses.length === 0 && !loadingSessions ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
                  <p className="text-sm font-semibold text-amber-800 mb-1">No courses found</p>
                  <p className="text-xs text-amber-700">
                    Go to <strong>Courses</strong> and add at least one course first. Study Coach needs a course to work with your materials.
                  </p>
                </div>
              ) : (
                <>
                  {/* Paper analysis topics panel */}
                  {selectedCourse && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                        {paperAnalysisLoading
                          ? '🔍 Loading course insights…'
                          : highProbTopics.length > 0
                          ? '📊 High-priority topics from your past papers'
                          : '📚 Course context'}
                      </p>
                      {paperAnalysisLoading ? (
                        <div className="flex gap-2 flex-wrap">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-7 w-24 rounded-full bg-slate-200 animate-pulse" />
                          ))}
                        </div>
                      ) : highProbTopics.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {highProbTopics.map((t) => (
                            <button
                              key={t.topic}
                              onClick={() => handleSendWithText(`Teach me about "${t.topic}" for the exam — it appears ${t.frequency} times in past papers`)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition"
                              title="Click to start a focused session on this topic"
                            >
                              🔴 {t.topic}
                              {t.frequency > 1 && <span className="text-rose-400 font-normal">×{t.frequency}</span>}
                            </button>
                          ))}
                          {(paperAnalysis?.repeat_topics || [])
                            .filter((t) => t.frequency === 1)
                            .slice(0, 3)
                            .map((t) => (
                              <button
                                key={t.topic}
                                onClick={() => handleSendWithText(`Give me an overview of "${t.topic}" for exam preparation`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition"
                              >
                                🟡 {t.topic}
                              </button>
                            ))}
                          <p className="w-full text-[10px] text-slate-400 mt-1">
                            Click any topic to start a focused session immediately.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Upload past papers in <strong>Question Lab</strong> and run AI analysis to unlock high-priority exam topics here.
                        </p>
                      )}
                    </div>
                  )}

                  {/* What do you want to do — one-tap mode cards */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">What do you want to do?</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { emoji: '🧠', title: 'Learn', desc: 'Understand a concept', prompt: 'Teach me the most important concept from my course materials in a clear, structured way', mode: 'learn' },
                        { emoji: '🎯', title: 'Practice', desc: 'Self-test with questions', prompt: 'Generate 5 practice questions from my course materials and quiz me step by step', mode: 'practice' },
                        { emoji: '📋', title: 'Summarize', desc: 'Key points only', prompt: 'Create a concise revision summary with bullet points of the most important topics in this course', mode: 'summary' },
                        { emoji: '🗓️', title: 'Study Plan', desc: 'Build a schedule', prompt: 'Create a focused 7-day study plan for my upcoming exam based on my course materials and most important topics', mode: 'exam' },
                      ].map((item) => (
                        <button
                          key={item.title}
                          onClick={() => {
                            handlePreferenceChange('responseMode', item.mode);
                            handleSendWithText(item.prompt);
                          }}
                          disabled={sending}
                          className="rounded-xl border border-slate-200 bg-white p-3 hover:border-emerald-300 hover:bg-emerald-50/60 transition text-left group disabled:opacity-50"
                        >
                          <span className="text-xl block mb-1.5">{item.emoji}</span>
                          <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-800">{item.title}</p>
                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5 hidden sm:block">{item.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Starter prompts — also auto-send */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Or ask directly</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {starterPrompts.map(({ q, icon }) => (
                        <button
                          key={q}
                          onClick={() => handleSendWithText(q)}
                          disabled={sending}
                          className="text-left text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition flex items-start gap-2 disabled:opacity-50"
                        >
                          <span className="text-sm shrink-0">{icon}</span>
                          <span>{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {!selectedCourse && (
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Target size={11} />
                      Select a course in the sidebar for material-grounded answers with citations.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : loadingMessages ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <MessagesSquare size={36} className="text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">Send a message to start your study workflow</p>
              <p className="text-xs text-slate-300 mt-2 max-w-xs">
                Tip: Upload PDFs in the Course View for course-grounded answers with citations.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onFollowUpClick={(prompt) => {
                    handleSendWithText(prompt);
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
