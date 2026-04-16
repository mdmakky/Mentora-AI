import { useState, useEffect } from 'react';
import { ShieldCheck, Users, FileText, Database, Activity, AlertTriangle, ClipboardList, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import Spinner from '../../components/ui/Spinner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const StatCard = ({ icon: Icon, title, value, gradient, shadowColor, subtitle }) => (
  <div className="relative group overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 block cursor-default">
    {/* Decorative background blur */}
    <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-30 ${gradient}`} />
    
    <div className="flex items-center gap-5">
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg ${shadowColor}`}>
        <Icon size={26} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <h3 className="text-3xl font-extrabold tracking-tight text-slate-800">{value}</h3>
        </div>
        {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/admin/stats');
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" className="text-indigo-600" />
        <p className="text-sm font-medium text-slate-400 animate-pulse">Initializing Administrative Vectors...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="m-8 flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-rose-700 shadow-sm backdrop-blur-xl">
      <div className="rounded-full bg-rose-100 p-3">
        <AlertTriangle size={24} className="text-rose-600" />
      </div>
      <div>
        <h3 className="font-bold">System Metric Failure</h3>
        <p className="text-sm opacity-80">{error}</p>
      </div>
    </div>
  );

  if (!stats) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
      
      {/* Sleek Header Context */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-8 py-10 shadow-2xl">
        {/* Dynamic mesh glow */}
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl mix-blend-screen" />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl mix-blend-screen" />
        
        <div className="relative z-10 flex items-center gap-5">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-xl shadow-inner">
            <ShieldCheck size={32} className="text-indigo-300" strokeWidth={2} />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              Command Center
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-400 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              System fully operational parameters normal.
            </p>
          </div>
        </div>
      </div>

      {/* Review Queue Action Banner — shown when there are pending reviews */}
      {(stats.pending_reviews > 0 || stats.quarantined_pending > 0) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {stats.pending_reviews > 0 && (
            <button
              onClick={() => navigate('/admin/documents?tab=review_pending')}
              className="flex-1 flex items-center gap-4 rounded-2xl bg-violet-600 px-6 py-4 text-white shadow-lg shadow-violet-500/30 hover:bg-violet-700 transition-all hover:-translate-y-0.5 active:translate-y-0 group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <ClipboardList size={22} strokeWidth={2.5} />
              </div>
              <div className="text-left flex-1">
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Action Required</p>
                <p className="text-lg font-extrabold">
                  {stats.pending_reviews} Review Request{stats.pending_reviews !== 1 ? 's' : ''} Pending
                </p>
              </div>
              <ChevronRight size={20} className="opacity-70 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
          {stats.quarantined_pending > 0 && (
            <button
              onClick={() => navigate('/admin/documents?tab=quarantined')}
              className="flex-1 flex items-center gap-4 rounded-2xl bg-amber-500 px-6 py-4 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-600 transition-all hover:-translate-y-0.5 active:translate-y-0 group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <AlertTriangle size={22} strokeWidth={2.5} />
              </div>
              <div className="text-left flex-1">
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Quarantined</p>
                <p className="text-lg font-extrabold">
                  {stats.quarantined_pending} Document{stats.quarantined_pending !== 1 ? 's' : ''} Flagged
                </p>
              </div>
              <ChevronRight size={20} className="opacity-70 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      )}

      {/* Grid Highlighting Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          icon={Users} 
          title="Total Users" 
          value={stats.total_users || 0}
          gradient="from-blue-500 to-indigo-600"
          shadowColor="shadow-blue-500/30"
          subtitle="Registered accounts"
        />
        <StatCard 
          icon={FileText} 
          title="Documents" 
          value={stats.total_documents || 0}
          gradient="from-emerald-400 to-teal-500"
          shadowColor="shadow-emerald-500/30"
          subtitle="Processed files"
        />
        <StatCard 
          icon={Database} 
          title="Knowledge Vectors" 
          value={stats.total_chunks || 0}
          gradient="from-purple-500 to-fuchsia-600"
          shadowColor="shadow-purple-500/30"
          subtitle="AI embeddings"
        />
        <StatCard 
          icon={Activity} 
          title="Active Courses" 
          value={stats.total_courses || 0}
          gradient="from-amber-400 to-orange-500"
          shadowColor="shadow-amber-500/30"
          subtitle="Learning spaces"
        />
      </div>

      {/* Visualizations Container */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md">
          <div className="mb-8">
             <h3 className="text-lg font-bold text-slate-800">Registration Velocity</h3>
             <p className="text-xs text-slate-500">Trailing 30-day chronological density.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.daily_registrations || []}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md flex flex-col items-center justify-center relative overflow-hidden group">
          {/* Aesthetic background */}
          <div className="absolute inset-0 bg-slate-50/50" />
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
          
          <div className="z-10 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 ring-4 ring-white shadow-xl group-hover:scale-110 transition-transform duration-500">
               <Activity size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Advanced Telemetry Offline</h3>
            <p className="mt-2 max-w-[280px] text-sm text-slate-500">Historical document parsing matrices require more than 30 days of standard payload rendering.</p>
            <button className="mt-6 rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:bg-slate-800">
               Export Base Metrics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
