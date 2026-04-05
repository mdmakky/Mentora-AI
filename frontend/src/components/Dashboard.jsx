import { useEffect, useState } from 'react';
import { Plus, FileText, MessagesSquare, TrendingUp, BookOpen } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useCourseStore from '../stores/courseStore';
import { apiClient } from '../lib/apiClient';
import SemesterSection from './dashboard/SemesterSection';
import Button from './ui/Button';
import Modal from './ui/Modal';
import Spinner from './ui/Spinner';
import EmptyState from './ui/EmptyState';

const Dashboard = () => {
  const user = useAuthStore((s) => s.user);
  const { semesters, loading, fetchSemesters } = useCourseStore();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: `1st Semester ${new Date().getFullYear()}`, year: new Date().getFullYear(), term: '1st', is_current: true });
  const [creating, setCreating] = useState(false);
  const createSemester = useCourseStore((s) => s.createSemester);

  // Dashboard stats
  const [stats, setStats] = useState({
    document_count: 0,
    chat_session_count: 0,
    course_count: 0,
    current_streak: 0,
  });

  useEffect(() => {
    fetchSemesters();
    // Fetch dashboard stats
    apiClient.get('/dashboard/stats').then((data) => {
      if (data) setStats(data);
    }).catch(() => {});
  }, [fetchSemesters]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    await createSemester({ ...form, year: parseInt(form.year) });
    setCreating(false);
    setShowCreate(false);
    setForm({ name: '', year: new Date().getFullYear(), term: 'Spring', is_current: true });
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">
          {greeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-slate-500">
          Welcome back to Mentora. Here{"'"}s your study overview.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Courses', value: stats.course_count, icon: BookOpen, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Documents', value: stats.document_count, icon: FileText, color: 'bg-blue-50 text-blue-600' },
          { label: 'Chat Sessions', value: stats.chat_session_count, icon: MessagesSquare, color: 'bg-violet-50 text-violet-600' },
          { label: 'Study Streak', value: `🔥 ${stats.current_streak} day${stats.current_streak !== 1 ? 's' : ''}`, icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
        ].map((stat) => (
          <div key={stat.label} className="card p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Semesters header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-slate-900">My Semesters</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Semester
        </Button>
      </div>

      {/* Semesters list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : semesters.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No semesters yet"
          description="Create your first semester to start organizing your courses and study materials."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Create Semester
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {semesters.map((sem, i) => (
            <div key={sem.id} className="animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
              <SemesterSection semester={sem} />
            </div>
          ))}
        </div>
      )}

      {/* Create Semester Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Semester">
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
                <option value="1st">1st</option>
                <option value="2nd">2nd</option>
                <option value="3rd">3rd</option>
                <option value="4th">4th</option>
                <option value="5th">5th</option>
                <option value="6th">6th</option>
                <option value="7th">7th</option>
                <option value="8th">8th</option>
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={creating}>
              Create Semester
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Dashboard;

