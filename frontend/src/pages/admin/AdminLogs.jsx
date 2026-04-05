import { useState, useEffect } from 'react';
import { Activity, Search, Server, UserX, DatabaseZap, Clock, FileWarning } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';

const getActionIcon = (actionType) => {
  if (actionType.includes('delete') || actionType.includes('suspend')) return <UserX size={14} />;
  if (actionType.includes('document')) return <FileWarning size={14} />;
  return <DatabaseZap size={14} />;
};

const getActionColor = (actionType) => {
  if (actionType.includes('delete') || actionType.includes('reject')) return 'text-rose-600 bg-rose-50 ring-rose-200/50';
  if (actionType.includes('suspend')) return 'text-amber-600 bg-amber-50 ring-amber-200/50';
  if (actionType.includes('approve')) return 'text-emerald-600 bg-emerald-50 ring-emerald-200/50';
  return 'text-blue-600 bg-blue-50 ring-blue-200/50';
};

const AdminLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({ page, per_page: 20 });
      if (filterType) queryParams.append('action_type', filterType);
      
      const data = await apiClient.get(`/admin/logs?${queryParams.toString()}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch systemic logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterType, page]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
      
      {/* Premium Header Context */}
      <div className="relative overflow-hidden rounded-3xl bg-white px-8 py-8 shadow-sm ring-1 ring-slate-100 flex items-center justify-between">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl" />
        
        <div className="relative z-10 flex items-center gap-6">
           <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
            <Server size={32} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Operational Auditing</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Immutable telemetry log tracking moderation directives and administrative overrides.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white shadow-lg shadow-slate-200/40 ring-1 ring-slate-100 overflow-hidden relative">
        {/* Sleek Filters */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 backdrop-blur-sm">
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="appearance-none rounded-xl border-none bg-white px-5 py-3 pr-10 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="">All Telemetry Events</option>
              <option value="suspend_user">Suspensions</option>
              <option value="approve_document">Approved Documents</option>
              <option value="reject_document">Rejected Documents</option>
              <option value="force_delete_document">Destructive Erases</option>
            </select>
          </div>
        </div>

        {/* Dynamic Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-[11px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-8 py-5">Administrator Signature</th>
                <th className="px-6 py-5">Action Directive</th>
                <th className="px-6 py-5">Target Node</th>
                <th className="px-8 py-5 text-right w-48">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-8 py-16 text-center">
                    <Spinner className="mx-auto text-emerald-500" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-16 text-center text-slate-400 font-medium">
                    Telemetry buffer is empty.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="group hover:bg-emerald-50/20 transition-colors duration-200">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white font-bold ring-2 ring-white shadow-sm">
                          {log.users?.email?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{log.users?.email || 'Unknown Protocol'}</span>
                          <span className="text-[10px] font-mono font-semibold text-slate-400 tracking-wide">{log.admin_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex flex-row items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm ring-1 ${getActionColor(log.action_type)}`}>
                        {getActionIcon(log.action_type)}
                        {log.action_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                         <span className="text-xs font-bold text-slate-500 uppercase">{log.target_type} Node</span>
                         <span className="text-xs font-mono font-medium text-slate-400">{log.target_id || 'Global'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                          <Clock size={12} strokeWidth={3} />
                          {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit', second: '2-digit' })}
                       </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Container */}
        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 bg-slate-50/50">
           <p>BUFFER {(page - 1) * 20 + (total > 0 ? 1 : 0)} TO {Math.min(page * 20, total)} OF {total}</p>
          <div className="flex gap-2 text-sm font-medium text-slate-600">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg bg-white shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-all active:scale-95"
            >
              Back
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 20 >= total}
              className="px-4 py-2 rounded-lg bg-white shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-all active:scale-95"
            >
              Forward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogs;
