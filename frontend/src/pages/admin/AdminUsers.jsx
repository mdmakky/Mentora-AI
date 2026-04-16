import { useState, useEffect } from 'react';
import { Users, Search, CheckCircle, RotateCcw, Ban, Trash2, Mail, Shield, X, MessageSquare, Clock, ChevronRight } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const AdminUsers = () => {
  const [tab, setTab] = useState('users'); // 'users' | 'appeals'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [suspendModal, setSuspendModal] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');

  // Appeals
  const [appeals, setAppeals] = useState([]);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealDeciding, setAppealDeciding] = useState(null); // appeal id being decided
  const [appealResponseModal, setAppealResponseModal] = useState(null); // { id, decision }
  const [appealResponse, setAppealResponse] = useState('');

  const fetchAppeals = async () => {
    try {
      setAppealsLoading(true);
      const data = await apiClient.get('/admin/suspension-appeals?status=pending');
      setAppeals(data || []);
    } catch (e) {
      toast.error('Failed to load appeals');
    } finally {
      setAppealsLoading(false);
    }
  };

  // Load appeal count on mount so badge is visible before clicking the tab.
  useEffect(() => { fetchAppeals(); }, []);
  useEffect(() => { if (tab === 'appeals') fetchAppeals(); }, [tab]);

  // Keep pending appeal badge and list fresh even if no manual refresh happens.
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchAppeals();
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Refresh immediately when returning to the page/tab.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchAppeals();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const submitAppealDecision = async () => {
    if (!appealResponseModal) return;
    const { id, decision } = appealResponseModal;
    setAppealDeciding(id);
    try {
      await apiClient.post(`/admin/suspension-appeals/${id}/decide`, {
        decision,
        admin_response: appealResponse.trim() || undefined,
      });
      toast.success(`Appeal ${decision}`);
      setAppeals(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      toast.error(e.message || 'Failed to decide appeal');
    } finally {
      setAppealDeciding(null);
      setAppealResponseModal(null);
      setAppealResponse('');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams({ page, per_page: 20 });
      if (search) q.append('search', search);
      if (filter) q.append('filter', filter);
      const data = await apiClient.get(`/admin/users?${q}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchUsers, 400);
    return () => clearTimeout(t);
  }, [search, filter, page]);

  const handleAction = async (action, userId, method, msg, extra = {}) => {
    try {
      if (method === 'DELETE') {
        setDeleteConfirm({ userId, msg });
        return;
      } else {
        await apiClient.put(`/admin/users/${userId}/${action}`, extra);
        toast.success(msg);
        fetchUsers();
      }
    } catch (e) {
      toast.error(e.message || 'Action failed');
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteConfirm) return;
    try {
      await apiClient.delete(`/admin/users/${deleteConfirm.userId}`);
      toast.success(deleteConfirm.msg || 'User deleted');
      fetchUsers();
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const confirmSuspend = async () => {
    if (!suspendModal) return;
    try {
      await apiClient.put(`/admin/users/${suspendModal.userId}/suspend`, { reason: suspendReason || 'Terms of service violation' });
      toast.success('User suspended');
      fetchUsers();
    } catch (e) {
      toast.error(e.message || 'Suspend failed');
    } finally {
      setSuspendModal(null);
      setSuspendReason('');
    }
  };

  return (
    <>
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <Users size={20} className="text-gray-400" strokeWidth={1.5} />
        <div>
          <h1 className="text-lg font-bold text-gray-800">User Management</h1>
          <p className="text-xs text-gray-400">Manage accounts, warnings, and suspensions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition ${tab === 'users' ? 'bg-white border border-b-white border-gray-200 text-gray-800 -mb-px' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Users
        </button>
        <button
          onClick={() => setTab('appeals')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition flex items-center gap-1.5 ${tab === 'appeals' ? 'bg-white border border-b-white border-gray-200 text-gray-800 -mb-px' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <MessageSquare size={13} />
          Suspension Appeals
          {appeals.length > 0 && tab !== 'appeals' && (
            <span className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white px-1">{appeals.length}</span>
          )}
        </button>
      </div>

      {/* ── Appeals tab ── */}
      {tab === 'appeals' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {appealsLoading ? (
            <div className="py-16 flex justify-center"><Spinner className="text-gray-400" /></div>
          ) : appeals.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare size={28} className="text-gray-200 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-gray-400">No pending suspension appeals</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {appeals.map(appeal => {
                const u = appeal.users || {};
                const suspendedAt = u.upload_suspended_at ? new Date(u.upload_suspended_at) : null;
                const liftAt = suspendedAt ? new Date(suspendedAt.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
                return (
                  <div key={appeal.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                          {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 text-sm">{u.full_name || '—'}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {liftAt && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock size={10} /> auto-lifts {liftAt.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-700 leading-relaxed">
                      "{appeal.message}"
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-400">
                        Submitted {new Date(appeal.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {u.warning_count > 0 && ` · ${u.warning_count}/3 warnings`}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setAppealResponse(''); setAppealResponseModal({ id: appeal.id, decision: 'rejected' }); }}
                          disabled={appealDeciding === appeal.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition disabled:opacity-40"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => { setAppealResponse(''); setAppealResponseModal({ id: appeal.id, decision: 'approved' }); }}
                          disabled={appealDeciding === appeal.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition disabled:opacity-40"
                        >
                          Approve & Lift
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Users tab ── */}
      {tab === 'users' && (<>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={1.5} />
          <input type="text" placeholder="Search by name or email…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-400">
          <option value="">All users</option>
          <option value="high_warning">High warnings (2+)</option>
          <option value="suspended">Suspended</option>
          <option value="unverified">Unverified email</option>
        </select>
      </div>

      {/* User list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner className="text-gray-400" /></div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No users found.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Warnings</th>
                    <th className="px-4 py-3 text-left">Joined</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                            {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{user.full_name || '—'}</p>
                            <p className="text-xs text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {user.is_upload_suspended ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5"><Ban size={10} /> Suspended</span>
                          ) : !user.email_verified ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"><Mail size={10} /> Unverified</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5"><CheckCircle size={10} /> Active</span>
                          )}
                          {user.is_admin && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5"><Shield size={10} /> Admin</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-sm font-semibold ${user.warning_count >= 3 ? 'text-red-600' : user.warning_count > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {user.warning_count} / 3
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-400">
                        {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                          {user.is_upload_suspended ? (
                            <button onClick={() => handleAction('unsuspend', user.id, 'PUT', 'User unsuspended')} className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors" title="Lift suspension"><CheckCircle size={15} strokeWidth={2} /></button>
                          ) : (
                            <button onClick={() => { setSuspendReason(''); setSuspendModal({ userId: user.id }); }} className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Suspend"><Ban size={15} strokeWidth={1.5} /></button>
                          )}
                          {user.warning_count > 0 && (
                            <button onClick={() => handleAction('reset-warnings', user.id, 'PUT', 'Warnings reset')} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Reset warnings"><RotateCcw size={15} strokeWidth={1.5} /></button>
                          )}
                          <button onClick={() => handleAction('delete', user.id, 'DELETE', 'User deleted')} className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-1" title="Delete user"><Trash2 size={15} strokeWidth={1.5} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {users.map(user => (
                <div key={user.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                        {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{user.full_name || '—'}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {user.is_upload_suspended ? (
                        <button onClick={() => handleAction('unsuspend', user.id, 'PUT', 'User unsuspended')} className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors" title="Lift suspension"><CheckCircle size={16} strokeWidth={2} /></button>
                      ) : (
                        <button onClick={() => { setSuspendReason(''); setSuspendModal({ userId: user.id }); }} className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Suspend"><Ban size={16} strokeWidth={1.5} /></button>
                      )}
                      {user.warning_count > 0 && (
                        <button onClick={() => handleAction('reset-warnings', user.id, 'PUT', 'Warnings reset')} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Reset warnings"><RotateCcw size={16} strokeWidth={1.5} /></button>
                      )}
                      <button onClick={() => handleAction('delete', user.id, 'DELETE', 'User deleted')} className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={16} strokeWidth={1.5} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {user.is_upload_suspended ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5"><Ban size={9} /> Suspended</span>
                    ) : !user.email_verified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"><Mail size={9} /> Unverified</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5"><CheckCircle size={9} /> Active</span>
                    )}
                    {user.is_admin && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5"><Shield size={9} /> Admin</span>
                    )}
                    <span className={`text-[11px] font-semibold ${user.warning_count >= 3 ? 'text-red-600' : user.warning_count > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {user.warning_count}/3 warnings
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Joined {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">{(page-1)*20+(total>0?1:0)}–{Math.min(page*20,total)} of {total} users</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">Prev</button>
            <button onClick={() => setPage(p => p+1)} disabled={page*20>=total}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      </div>
      </>)}
    </div>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDeleteUser}
        title="Permanently delete user?"
        message="This will remove the user and all their data including documents, courses, and chat history. This action cannot be undone."
        confirmLabel="Delete User"
        confirmVariant="danger"
      />

      {/* Suspend modal */}
      {suspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSuspendModal(null); }}>
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 px-6 pt-7 pb-6">
            <button onClick={() => setSuspendModal(null)} className="absolute right-3 top-3 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <X size={16} />
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">Suspend user?</h3>
            <p className="text-sm text-slate-500 mb-4">The user will lose the ability to upload documents. At 3 warnings an account is automatically suspended.</p>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reason <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              placeholder="e.g. Repeated copyright violations"
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none mb-4"
            />
            <div className="flex gap-2.5">
              <button onClick={() => setSuspendModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={confirmSuspend} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-sm font-semibold text-white transition">
                Suspend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appeal decision modal */}
      {appealResponseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) { setAppealResponseModal(null); setAppealResponse(''); } }}>
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 px-6 pt-7 pb-6">
            <button onClick={() => { setAppealResponseModal(null); setAppealResponse(''); }} className="absolute right-3 top-3 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <X size={16} />
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {appealResponseModal.decision === 'approved' ? 'Approve Appeal' : 'Reject Appeal'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {appealResponseModal.decision === 'approved'
                ? 'The user\'s suspension will be lifted and they will be notified.'
                : 'The user will remain suspended and will be notified with your response.'}
            </p>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Response to user <span className="font-normal text-slate-400">(optional)</span></label>
            <textarea
              value={appealResponse}
              onChange={e => setAppealResponse(e.target.value)}
              placeholder={appealResponseModal.decision === 'approved' ? 'e.g. We reviewed your case and have lifted the suspension.' : 'e.g. The documents you uploaded contained copyrighted material. Please review our guidelines.'}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none mb-4"
            />
            <div className="flex gap-2.5">
              <button onClick={() => { setAppealResponseModal(null); setAppealResponse(''); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                onClick={submitAppealDecision}
                disabled={!!appealDeciding}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 ${appealResponseModal.decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}
              >
                {appealDeciding ? 'Saving…' : appealResponseModal.decision === 'approved' ? 'Approve & Lift' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminUsers;
