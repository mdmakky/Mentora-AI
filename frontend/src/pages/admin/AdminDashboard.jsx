import { useState, useEffect } from 'react';
import { ShieldCheck, Users, FileText, Database, BookOpen, AlertTriangle, ClipboardList, TrendingUp, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import Spinner from '../../components/ui/Spinner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StatCard = ({ icon: Icon, label, value, sub, accent }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
        <Icon size={15} strokeWidth={2} />
      </div>
    </div>
    <p className="text-3xl font-bold text-gray-800">{value ?? '—'}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient.get('/admin/stats')
      .then(setStats)
      .catch(e => setError(e.message || 'Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]"><Spinner className="text-gray-400" /></div>
  );

  if (error) return (
    <div className="m-8 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
      <AlertTriangle size={18} strokeWidth={1.5} />
      <p className="text-sm">{error}</p>
    </div>
  );

  if (!stats) return null;

  const hasPendingActions = stats.pending_reviews > 0 || stats.quarantined_pending > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <ShieldCheck size={20} className="text-gray-400" strokeWidth={1.5} />
        <div>
          <h1 className="text-lg font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-xs text-gray-400">System overview and pending actions</p>
        </div>
      </div>

      {/* Action Banners */}
      {hasPendingActions && (
        <div className="flex flex-col sm:flex-row gap-3">
          {stats.pending_reviews > 0 && (
            <button
              onClick={() => navigate('/admin/documents?tab=review_pending')}
              className="flex-1 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3.5 text-left hover:bg-violet-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <ClipboardList size={16} className="text-violet-600 shrink-0" strokeWidth={2} />
                <div>
                  <p className="text-sm font-semibold text-violet-800">
                    {stats.pending_reviews} review request{stats.pending_reviews !== 1 ? 's' : ''} pending
                  </p>
                  <p className="text-xs text-violet-500">User appeals waiting for your decision</p>
                </div>
              </div>
              <ArrowRight size={14} className="text-violet-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          )}
          {stats.quarantined_pending > 0 && (
            <button
              onClick={() => navigate('/admin/documents?tab=quarantined')}
              className="flex-1 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-left hover:bg-amber-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" strokeWidth={2} />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {stats.quarantined_pending} document{stats.quarantined_pending !== 1 ? 's' : ''} quarantined
                  </p>
                  <p className="text-xs text-amber-500">Flagged content awaiting moderation</p>
                </div>
              </div>
              <ArrowRight size={14} className="text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          )}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats.total_users} sub={`${stats.verified_users ?? 0} verified`} accent="bg-blue-50 text-blue-500" />
        <StatCard icon={FileText} label="Documents" value={stats.total_documents} sub="uploaded files" accent="bg-green-50 text-green-500" />
        <StatCard icon={Database} label="AI Chunks" value={stats.total_chunks} sub="embedded vectors" accent="bg-purple-50 text-purple-500" />
        <StatCard icon={BookOpen} label="Courses" value={stats.total_courses} sub="active courses" accent="bg-orange-50 text-orange-500" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{stats.active_sessions_24h ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Sessions (last 24h)</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className={`text-2xl font-bold ${stats.suspended_users > 0 ? 'text-red-600' : 'text-gray-800'}`}>{stats.suspended_users ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Suspended users</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{(stats.total_users ?? 0) - (stats.verified_users ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Unverified accounts</p>
        </div>
      </div>

      {/* Registration chart */}
      {stats.daily_registrations?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={15} className="text-gray-400" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-semibold text-gray-700">New Registrations</p>
              <p className="text-xs text-gray-400">Last 30 days</p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.daily_registrations}>
                <defs>
                  <linearGradient id="reg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={v => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} width={28} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                  labelFormatter={v => new Date(v).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#reg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'User Management', desc: 'Manage accounts', path: '/admin/users' },
          { label: 'Review Queue', desc: `${stats.pending_reviews ?? 0} pending`, path: '/admin/documents?tab=review_pending' },
          { label: 'Quarantine', desc: `${stats.quarantined_pending ?? 0} flagged`, path: '/admin/documents' },
          { label: 'Activity Log', desc: 'Audit trail', path: '/admin/logs' },
        ].map(link => (
          <button key={link.path} onClick={() => navigate(link.path)}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-left hover:bg-gray-50 transition-colors group">
            <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{link.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{link.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
