import { useState, useEffect } from 'react';
import { Users, Search, CheckCircle, RotateCcw, Ban, Trash2, Mail, Shield } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [deleteConfirm, setDeleteConfirm] = useState(null); // { userId }

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

      {/* Filters */}
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

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
            {loading ? (
              <tr><td colSpan="5" className="py-16 text-center"><Spinner className="mx-auto text-gray-400" /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="5" className="py-16 text-center text-sm text-gray-400">No users found.</td></tr>
            ) : users.map(user => (
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
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                        <Ban size={10} /> Suspended
                      </span>
                    ) : !user.email_verified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        <Mail size={10} /> Unverified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                        <CheckCircle size={10} /> Active
                      </span>
                    )}
                    {user.is_admin && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">
                        <Shield size={10} /> Admin
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-sm font-semibold ${
                    user.warning_count >= 3 ? 'text-red-600' :
                    user.warning_count > 0 ? 'text-amber-600' : 'text-gray-400'
                  }`}>
                    {user.warning_count} / 3
                  </span>
                </td>
                <td className="px-4 py-3.5 text-xs text-gray-400">
                  {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    {user.is_upload_suspended ? (
                      <button onClick={() => handleAction('unsuspend', user.id, 'PUT', 'User unsuspended')}
                        className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors" title="Lift suspension">
                        <CheckCircle size={15} strokeWidth={2} />
                      </button>
                    ) : (
                      <button onClick={() => {
                        const reason = prompt('Reason for suspension:');
                        if (reason !== null) handleAction('suspend', user.id, 'PUT', 'User suspended', { reason: reason || 'Terms of service violation' });
                      }}
                        className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Suspend">
                        <Ban size={15} strokeWidth={1.5} />
                      </button>
                    )}
                    {user.warning_count > 0 && (
                      <button onClick={() => handleAction('reset-warnings', user.id, 'PUT', 'Warnings reset')}
                        className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Reset warnings">
                        <RotateCcw size={15} strokeWidth={1.5} />
                      </button>
                    )}
                    <button onClick={() => handleAction('delete', user.id, 'DELETE', 'User deleted')}
                      className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-1" title="Delete user">
                      <Trash2 size={15} strokeWidth={1.5} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    </>
  );
};

export default AdminUsers;
