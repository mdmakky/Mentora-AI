import { useState, useEffect } from 'react';
import { Users, Search, ShieldAlert, CheckCircle, RotateCcw, Ban, Trash2, Mail, MoreVertical } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({ page, per_page: 20 });
      if (search) queryParams.append('search', search);
      if (filter) queryParams.append('filter', filter);
      
      const data = await apiClient.get(`/admin/users?${queryParams.toString()}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search, filter, page]);

  const handleAction = async (action, userId, apiAction, successMsg, extraData = {}) => {
    try {
      if (apiAction === 'DELETE') {
        const confirmDelete = window.confirm('Are you absolutely sure you want to permanently delete this user and all their data?');
        if (!confirmDelete) return;
        await apiClient.delete(`/admin/users/${userId}`);
      } else {
        await apiClient.put(`/admin/users/${userId}/${action}`, extraData);
      }
      toast.success(successMsg);
      fetchUsers();
    } catch (error) {
      toast.error(error.message || `Failed to complete action`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
      
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white px-8 py-8 shadow-sm ring-1 ring-slate-100 flex items-center justify-between">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-6">
           <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
            <Users size={32} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Operational Users</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Active moderation and compliance management
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white shadow-lg shadow-slate-200/40 ring-1 ring-slate-100 overflow-hidden">
        {/* Floating Filters */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50 backdrop-blur-sm">
          <div className="relative w-full sm:w-[400px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or email identity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border-none bg-white py-3.5 pl-12 pr-4 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
            <select
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(1); }}
              className="appearance-none rounded-xl border-none bg-white px-5 py-3.5 pr-10 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">All Identities</option>
              <option value="high_warning">High Warnings (2+)</option>
              <option value="suspended">Suspended Accounts</option>
              <option value="unverified">Unverified Emails</option>
            </select>
          </div>
        </div>

        {/* Dynamic Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
             <thead>
              <tr className="bg-white border-b border-slate-100 text-[11px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-8 py-5">Identity Protocol</th>
                <th className="px-6 py-5">Clearance Status</th>
                <th className="px-6 py-5">Violation Matrix</th>
                <th className="px-6 py-5">Creation Hash</th>
                <th className="px-8 py-5 text-right w-32">Directives</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-16 text-center">
                    <Spinner className="mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-16 text-center text-slate-400 font-medium">
                     No identities matching active parameters.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="group hover:bg-blue-50/30 transition-colors duration-200">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 ring-2 ring-white shadow-sm">
                          {user.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{user.full_name}</span>
                          <span className="text-xs font-medium text-slate-400">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-2">
                        {user.is_upload_suspended ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold ring-1 ring-rose-200/50 shadow-sm">
                            <Ban size={12} strokeWidth={3} /> SUSPENDED
                          </span>
                        ) : !user.email_verified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold ring-1 ring-amber-200/50 shadow-sm">
                            <Mail size={12} strokeWidth={3} /> UNVERIFIED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold ring-1 ring-emerald-200/50 shadow-sm">
                            <CheckCircle size={12} strokeWidth={3} /> ACTIVE
                          </span>
                        )}
                        {user.is_admin && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold ring-1 ring-violet-200/50 shadow-sm">
                            <ShieldAlert size={12} strokeWidth={3} /> ADMIN
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-full text-[11px] font-black tracking-wide shadow-sm ring-1 ${
                        user.warning_count >= 3 ? 'bg-rose-50 text-rose-700 ring-rose-200/50' :
                        user.warning_count > 0 ? 'bg-amber-50 text-amber-700 ring-amber-200/50' :
                        'bg-slate-50 text-slate-500 ring-slate-200/50'
                      }`}>
                        {user.warning_count} / 3
                      </span>
                    </td>
                    <td className="px-6 py-5 text-xs font-semibold text-slate-400">
                      {new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        {user.is_upload_suspended ? (
                          <button
                            onClick={() => handleAction('unsuspend', user.id, 'PUT', 'Account unsuspended')}
                            className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg hover:scale-110 active:scale-95 transition-all shadow-sm ring-1 ring-emerald-200/50 bg-emerald-50"
                            title="Lift Suspension"
                          >
                            <CheckCircle size={16} strokeWidth={3} />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const reason = prompt('Reason for suspension:');
                              if (reason !== null) {
                                handleAction('suspend', user.id, 'PUT', 'Account suspended', { reason: reason || 'Violation of TOS' });
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-amber-600 focus:bg-amber-100 hover:bg-amber-50 rounded-lg hover:scale-110 active:scale-95 transition-all"
                            title="Enact Suspension"
                          >
                            <Ban size={16} strokeWidth={2.5} />
                          </button>
                        )}

                        {user.warning_count > 0 && (
                          <button
                            onClick={() => handleAction('reset-warnings', user.id, 'PUT', 'Warnings reset')}
                            className="p-2 text-slate-400 hover:text-blue-600 focus:bg-blue-100 hover:bg-blue-50 rounded-lg hover:scale-110 active:scale-95 transition-all"
                            title="Reset Violation Count"
                          >
                            <RotateCcw size={16} strokeWidth={2.5} />
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleAction('delete', user.id, 'DELETE', 'User permanently deleted')}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg ml-3 hover:scale-110 active:scale-95 transition-all"
                          title="Purge Identity"
                        >
                          <Trash2 size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 bg-slate-50/50">
          <p>INDEX {(page - 1) * 20 + 1} TO {Math.min(page * 20, total)} OF {total}</p>
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

export default AdminUsers;
