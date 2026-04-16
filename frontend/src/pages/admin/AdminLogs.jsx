import { useState, useEffect } from 'react';
import { Activity, Clock } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';

const ACTION_LABELS = {
  suspend_user:                 { label: 'User suspended',              color: 'text-red-700 bg-red-50 border-red-200' },
  unsuspend_user:               { label: 'User unsuspended',            color: 'text-green-700 bg-green-50 border-green-200' },
  warn_user:                    { label: 'Warning issued',              color: 'text-amber-700 bg-amber-50 border-amber-200' },
  reset_warnings:               { label: 'Warnings reset',              color: 'text-blue-700 bg-blue-50 border-blue-200' },
  verify_email:                 { label: 'Email verified',              color: 'text-green-700 bg-green-50 border-green-200' },
  delete_user:                  { label: 'User deleted',                color: 'text-red-700 bg-red-50 border-red-200' },
  approve_document:             { label: 'Document approved',           color: 'text-green-700 bg-green-50 border-green-200' },
  reject_document:              { label: 'Document rejected',           color: 'text-red-700 bg-red-50 border-red-200' },
  reject_document_warn:         { label: 'Rejected + warning issued',   color: 'text-amber-700 bg-amber-50 border-amber-200' },
  reject_document_suspend:      { label: 'Rejected + user suspended',   color: 'text-red-700 bg-red-50 border-red-200' },
  review_approve:               { label: 'Appeal approved',             color: 'text-green-700 bg-green-50 border-green-200' },
  review_reject_with_penalty:   { label: 'Appeal rejected',             color: 'text-red-700 bg-red-50 border-red-200' },
  force_delete_document:        { label: 'Document force deleted',      color: 'text-red-700 bg-red-50 border-red-200' },
};

const getAction = (type) => ACTION_LABELS[type] || { label: type.replace(/_/g, ' '), color: 'text-gray-600 bg-gray-50 border-gray-200' };

const AdminLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams({ page, per_page: 25 });
      if (filterType) q.append('action_type', filterType);
      const data = await apiClient.get(`/admin/logs?${q}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [filterType, page]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <Activity size={20} className="text-gray-400" strokeWidth={1.5} />
        <div>
          <h1 className="text-lg font-bold text-gray-800">Activity Log</h1>
          <p className="text-xs text-gray-400">Audit trail of all admin actions</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-400">
          <option value="">All actions</option>
          <option value="suspend_user">Suspensions</option>
          <option value="unsuspend_user">Unsuspensions</option>
          <option value="warn_user">Warnings issued</option>
          <option value="reset_warnings">Warnings reset</option>
          <option value="verify_email">Email verifications</option>
          <option value="delete_user">User deletions</option>
          <option value="approve_document">Documents approved</option>
          <option value="reject_document">Documents rejected</option>
          <option value="reject_document_warn">Rejected + warned</option>
          <option value="reject_document_suspend">Rejected + suspended</option>
          <option value="review_approve">Appeals approved</option>
          <option value="review_reject_with_penalty">Appeals rejected</option>
          <option value="force_delete_document">Force deletions</option>
        </select>
        {total > 0 && <span className="text-xs text-gray-400">{total} entries</span>}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-24 flex justify-center"><Spinner className="text-gray-400" /></div>
        ) : logs.length === 0 ? (
          <div className="py-24 flex flex-col items-center gap-3 text-center px-6">
            <Activity size={36} className="text-gray-200" strokeWidth={1.5} />
            <p className="text-sm font-medium text-gray-400">No activity logged yet</p>
            <p className="text-xs text-gray-300">{filterType ? 'No entries match this filter. Try selecting a different action.' : 'Admin actions will appear here.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Admin</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Target</th>
                    <th className="px-5 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(log => {
                    const action = getAction(log.action_type);
                    return (
                      <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 text-white text-[11px] font-bold">
                              {log.users?.email?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <p className="text-sm text-gray-700 font-medium">{log.users?.email || 'Unknown'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center text-[11px] font-semibold border rounded px-2 py-0.5 ${action.color}`}>
                            {action.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-gray-500 capitalize">{log.target_type || '—'}</p>
                          {log.details && (
                            <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]" title={JSON.stringify(log.details)}>
                              {typeof log.details === 'string' ? log.details : log.details?.reason || log.details?.note || ''}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                            <Clock size={11} strokeWidth={1.5} />
                            {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {logs.map(log => {
                const action = getAction(log.action_type);
                const detail = log.details && (typeof log.details === 'string' ? log.details : log.details?.reason || log.details?.note || '');
                return (
                  <div key={log.id} className="px-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-white text-xs font-bold">
                          {log.users?.email?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <p className="text-sm font-medium text-gray-700 truncate">{log.users?.email || 'Unknown'}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 shrink-0 mt-1">
                        <Clock size={10} strokeWidth={1.5} />
                        {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center text-[11px] font-semibold border rounded px-2 py-0.5 ${action.color}`}>
                        {action.label}
                      </span>
                      {log.target_type && (
                        <span className="text-[11px] text-gray-400 capitalize">{log.target_type}</span>
                      )}
                    </div>
                    {detail ? (
                      <p className="text-[11px] text-gray-400 leading-relaxed">{detail}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">{(page-1)*25+(total>0?1:0)}–{Math.min(page*25,total)} of {total}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">Prev</button>
            <button onClick={() => setPage(p => p+1)} disabled={page*25>=total}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogs;
