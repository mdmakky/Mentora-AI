import { useEffect, useState, useCallback } from 'react';
import { Plus, FileText, MessagesSquare, TrendingUp, BookOpen } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useCourseStore from '../stores/courseStore';
import { apiClient } from '../lib/apiClient';
import SemesterSection from './dashboard/SemesterSection';
import Button from './ui/Button';
import Modal from './ui/Modal';
import Spinner from './ui/Spinner';
import EmptyState from './ui/EmptyState';

const SEMESTER_TERMS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

const extractSemesterNumber = (semester) => {
  const text = `${semester?.term || ''} ${semester?.name || ''}`.toLowerCase();
  const match = text.match(/\b([1-8])(?:st|nd|rd|th)?\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 1 && value <= 8 ? value : null;
};

const Dashboard = () => {
  const user = useAuthStore((s) => s.user);
  const { semesters, loading, fetchSemesters } = useCourseStore();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: `1st Semester ${new Date().getFullYear()}`, year: new Date().getFullYear(), term: '1st', is_current: true });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const createSemester = useCourseStore((s) => s.createSemester);

  const usedSemesterNumbers = new Set(
    (semesters || [])
      .map((s) => extractSemesterNumber(s))
      .filter((n) => Number.isFinite(n))
  );
  const availableTerms = SEMESTER_TERMS.filter((term, index) => !usedSemesterNumbers.has(index + 1));

  // Dashboard stats
  const [stats, setStats] = useState({
    document_count: 0,
    chat_session_count: 0,
    course_count: 0,
    current_streak: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(false);

  const loadStats = useCallback(() => {
    setLoadingStats(true);
    setStatsError(false);
    apiClient.get('/dashboard/stats').then((data) => {
      if (data) setStats(data);
      setLoadingStats(false);
    }).catch(() => {
      setStatsError(true);
      setLoadingStats(false);
    });
  }, []);

  useEffect(() => {
    fetchSemesters();
    loadStats();
  }, [fetchSemesters, loadStats]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (!availableTerms.includes(form.term)) {
      setCreateError('This semester already exists. Please choose another semester number.');
      return;
    }
    if (availableTerms.length === 0) {
      setCreateError('You already have all 8 semesters.');
      return;
    }

    setCreating(true);
    const result = await createSemester({ ...form, year: parseInt(form.year, 10) });
    setCreating(false);
    if (!result.success) {
      setCreateError(result.error || 'Failed to create semester');
      return;
    }
    loadStats();

    setShowCreate(false);
    const nextTerm = availableTerms[0] || '1st';
    setForm({
      name: `${nextTerm} Semester ${new Date().getFullYear()}`,
      year: new Date().getFullYear(),
      term: nextTerm,
      is_current: true,
    });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="app-content animate-fade-in">
      {/* Hero greeting */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">
          {greeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-slate-500 text-sm sm:text-base">
          Welcome back to Mentora. Here{"'"}s your study overview.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 min-[430px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {loadingStats ? (
          // Skeleton loaders
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 sm:p-5 flex items-center gap-4 animate-pulse min-w-0">
              <div className="w-11 h-11 rounded-xl bg-slate-100" />
              <div className="space-y-2 flex-1">
                <div className="h-6 w-12 bg-slate-100 rounded" />
                <div className="h-3 w-20 bg-slate-100 rounded" />
              </div>
            </div>
          ))
        ) : (
          [
            { label: 'Courses', value: statsError ? '—' : stats.course_count, icon: BookOpen, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Documents', value: statsError ? '—' : stats.document_count, icon: FileText, color: 'bg-blue-50 text-blue-600' },
            { label: 'Chat Sessions', value: statsError ? '—' : stats.chat_session_count, icon: MessagesSquare, color: 'bg-violet-50 text-violet-600' },
            { label: 'Study Streak', value: statsError ? '—' : `🔥 ${stats.current_streak} day${stats.current_streak !== 1 ? 's' : ''}`, icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
          ].map((stat) => (
            <div key={stat.label} className="card p-4 sm:p-5 flex items-center gap-4 min-w-0">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <div className="min-w-0">
                <p className={`text-lg sm:text-2xl leading-tight font-bold wrap-break-word ${statsError ? 'text-slate-400' : 'text-slate-900'}`}>{stat.value}</p>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Semesters header */}
      <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3 mb-4 sm:mb-5">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">My Semesters</h2>
        <Button
          size="sm"
          onClick={() => {
            const nextTerm = availableTerms[0] || '1st';
            setCreateError('');
            setForm((prev) => ({
              ...prev,
              term: nextTerm,
              name: `${nextTerm} Semester ${prev.year}`,
            }));
            setShowCreate(true);
          }}
        >
          <Plus size={16} /> Add Semester
        </Button>
      </div>

      {/* Semesters list */}
      {loading && semesters.length === 0 ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-6 w-48 bg-slate-200 rounded mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-32 bg-slate-100 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : semesters.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No semesters yet"
          description="Create your first semester to start organizing your courses and study materials."
          action={
              <Button onClick={() => {
                const nextTerm = availableTerms[0] || '1st';
                setCreateError('');
                setForm((prev) => ({
                  ...prev,
                  term: nextTerm,
                  name: `${nextTerm} Semester ${prev.year}`,
                }));
                setShowCreate(true);
              }}>
              <Plus size={16} /> Create Semester
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {semesters.map((sem, i) => (
            <div key={sem.id} className="animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                <SemesterSection semester={sem} onDataChanged={loadStats} />
            </div>
          ))}
        </div>
      )}

      {/* Create Semester Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Semester">
        {availableTerms.length === 0 ? (
          <div className="text-sm text-slate-600">All 8 semesters are already created.</div>
        ) : (
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Semester</label>
              <select
                value={form.term}
                onChange={(e) => {
                  const term = e.target.value;
                  setForm({ ...form, term, name: `${term} Semester ${form.year}` });
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition bg-white"
              >
                {availableTerms.map((term) => (
                  <option key={term} value={term}>{term}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Year</label>
              <input
                type="number"
                required
                value={form.year}
                onChange={(e) => {
                  const year = e.target.value;
                  setForm({ ...form, year, name: `${form.term} Semester ${year}` });
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Semester Name</label>
            <input
              type="text"
              required
              placeholder="e.g. 1st Semester 2026"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_current}
              onChange={(e) => setForm({ ...form, is_current: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Set as current semester
          </label>
          {createError && <p className="text-sm text-rose-600">{createError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={creating}>
              Create Semester
            </Button>
          </div>
        </form>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;

