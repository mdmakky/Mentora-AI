import { useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Flame, Target, Clock, TrendingUp, Award, BookOpen } from 'lucide-react';
import useStudyStore from '../stores/studyStore';
import Spinner from '../components/ui/Spinner';

const PIE_COLORS = ['#059669', '#2563EB', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#E11D48', '#4F46E5'];

const AnalyticsPage = () => {
  const { dashboardData, weeklyData, courseStats, streak, todayStats, loading, fetchDashboard } =
    useStudyStore();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="app-content flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  const goalMinutes = todayStats?.goal_minutes || 120;
  const todayMinutes = todayStats?.total_minutes || 0;
  const goalProgress = Math.min((todayMinutes / goalMinutes) * 100, 100);
  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;

  // Format minutes to hours and minutes
  const formatTime = (mins) => {
    if (!mins) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const totalWeekMinutes = weeklyData.reduce((sum, d) => sum + (d.total_minutes || 0), 0);

  return (
    <div className="app-content animate-fade-in">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Study Analytics</h1>
        <p className="text-slate-500 text-sm">Track your progress and build consistent study habits.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Clock size={18} className="text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Today</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatTime(todayMinutes)}</p>
          <div className="mt-2 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${goalProgress}%`,
                background: goalProgress >= 100
                  ? 'linear-gradient(90deg, #059669, #10b981)'
                  : 'linear-gradient(90deg, #2563eb, #3b82f6)',
              }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Goal: {formatTime(goalMinutes)}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Flame size={18} className="text-amber-600" />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Streak</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            🔥 {currentStreak} day{currentStreak !== 1 && 's'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Longest: {longestStreak} days</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <TrendingUp size={18} className="text-blue-600" />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">This Week</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatTime(totalWeekMinutes)}</p>
          <p className="text-[10px] text-slate-400 mt-1">
            {weeklyData.filter((d) => d.goal_achieved).length}/7 goals met
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <Award size={18} className="text-violet-600" />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg / Day</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatTime(weeklyData.length > 0 ? Math.round(totalWeekMinutes / 7) : 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Last 7 days average</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Weekly Bar Chart */}
        <div className="lg:col-span-2 card p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Weekly Study Time</h3>
          <p className="text-xs text-slate-400 mb-4">Minutes studied per day this week</p>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickFormatter={(v) => `${v}m`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '13px',
                  }}
                  formatter={(value) => [`${value} min`, 'Study Time']}
                />
                <Bar
                  dataKey="total_minutes"
                  radius={[6, 6, 0, 0]}
                  fill="#059669"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-slate-400 text-sm">
              No study data this week yet. Start studying to see your chart!
            </div>
          )}
        </div>

        {/* Course Breakdown Pie */}
        <div className="card p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-1">By Course</h3>
          <p className="text-xs text-slate-400 mb-4">Total study time per course</p>
          {courseStats.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={courseStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="total_minutes"
                    nameKey="course_name"
                    paddingAngle={3}
                  >
                    {courseStats.map((entry, index) => (
                      <Cell key={entry.course_id} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [`${formatTime(value)}`, 'Time']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {courseStats.map((c, i) => (
                  <div key={c.course_id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: c.color || PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-slate-700 truncate">{c.course_name}</span>
                    </div>
                    <span className="text-slate-500 font-medium flex-shrink-0 ml-2">{formatTime(c.total_minutes)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-slate-400 text-sm text-center">
              <BookOpen size={24} className="mb-2 text-slate-200" />
              No course study data yet
            </div>
          )}
        </div>
      </div>

      {/* Goal Streak Calendar */}
      <div className="card p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Daily Goals</h3>
        <p className="text-xs text-slate-400 mb-4">Whether you met your daily study goal each day this week</p>
        <div className="grid grid-cols-7 gap-1 sm:gap-3">
          {weeklyData.map((day) => (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="text-[10px] font-medium text-slate-400 uppercase">{day.day}</span>
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xs sm:text-sm font-bold transition-all ${
                  day.goal_achieved
                    ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200'
                    : day.total_minutes > 0
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-50 text-slate-300'
                }`}
              >
                {day.goal_achieved ? '✓' : day.total_minutes > 0 ? '◑' : '·'}
              </div>
              <span className="text-[10px] text-slate-400">
                {day.total_minutes > 0 ? formatTime(day.total_minutes) : '—'}
              </span>
            </div>
          ))}
        </div>
        {weeklyData.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            <Target size={24} className="mx-auto mb-2 text-slate-200" />
            Start studying to populate your weekly calendar
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
