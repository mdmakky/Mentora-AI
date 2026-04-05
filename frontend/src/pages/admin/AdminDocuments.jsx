import { useState, useEffect } from 'react';
import { FileWarning, CheckCircle, XCircle, Search, Trash2, Eye, ExternalLink } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';

const AdminDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('quarantined');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({ page, per_page: 20 });
      if (statusFilter) queryParams.append('status', statusFilter);
      
      const data = await apiClient.get(`/admin/documents?${queryParams.toString()}`);
      setDocuments(data.documents || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [statusFilter, page]);

  const handleAction = async (action, docId, successMsg) => {
    try {
      if (action === 'force-delete') {
        const confirmDelete = window.confirm('Permanently delete this document from the system?');
        if (!confirmDelete) return;
        await apiClient.delete(`/admin/documents/${docId}/force-delete`);
      } else if (action === 'reject') {
        const warnUser = window.confirm('Do you want to add a copyright violation warning to the user\'s profile?');
        await apiClient.put(`/admin/documents/${docId}/reject`, { warn_user: warnUser, suspend_user_flag: false });
      } else {
        await apiClient.put(`/admin/documents/${docId}/${action}`);
      }
      toast.success(successMsg);
      fetchDocuments();
    } catch (error) {
      toast.error(error.message || `Failed to ${action} document`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
      
      {/* Premium Header Context */}
      <div className="relative overflow-hidden rounded-3xl bg-white px-8 py-8 shadow-sm ring-1 ring-slate-100 flex items-center justify-between">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative z-10 flex items-center gap-6">
           <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30">
            <FileWarning size={32} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Quarantine Filters</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Systematic oversight of copyright violations and ingestion processing errors
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white shadow-lg shadow-slate-200/40 ring-1 ring-slate-100 overflow-hidden">
        {/* Sleek Floating Tabs */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50 backdrop-blur-sm">
          {['quarantined', 'pending', 'processed'].map(status => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              className={`relative px-5 py-2.5 rounded-full text-[13px] font-bold uppercase tracking-wider transition-all duration-300 ${
                statusFilter === status 
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/25 scale-105' 
                  : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 ring-1 ring-slate-200 shadow-sm'
              }`}
            >
              {status}
              {statusFilter === status && status === 'quarantined' && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-400 border-2 border-white"></span>
                </span>
              )}
            </button>
          ))}
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <button
             onClick={() => { setStatusFilter(''); setPage(1); }}
             className={`px-5 py-2.5 rounded-full text-[13px] font-bold uppercase tracking-wider transition-all duration-300 ${
                statusFilter === '' 
                  ? 'bg-slate-800 text-white shadow-md scale-105' 
                  : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 ring-1 ring-slate-200 shadow-sm'
              }`}
          >
            Universal Query
          </button>
        </div>

        {/* Dynamic Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-[11px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-8 py-5">Source Material</th>
                <th className="px-6 py-5">Uploader Origin</th>
                <th className="px-6 py-5">Verification Matrix</th>
                <th className="px-6 py-5">Timestamp Hash</th>
                <th className="px-8 py-5 text-right w-32">Directives</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-16 text-center">
                    <Spinner className="mx-auto text-violet-500" />
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-16 text-center text-slate-400 font-medium">
                    Sector scan complete. No documents detected under this matrix.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="group hover:bg-violet-50/30 transition-colors duration-200">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm ring-1 ${
                          doc.file_type === 'pdf' ? 'bg-red-50 text-red-600 ring-red-200' : 
                          doc.file_type === 'docx' ? 'bg-blue-50 text-blue-600 ring-blue-200' : 
                          'bg-orange-50 text-orange-600 ring-orange-200'
                        }`}>
                           {doc.file_type.toUpperCase()}
                        </div>
                        <div className="flex flex-col max-w-[200px]">
                          <span className="font-bold text-slate-800 truncate" title={doc.file_name}>{doc.file_name}</span>
                          <span className="text-[11px] font-semibold text-slate-400 tracking-wide">{(doc.file_size / 1024 / 1024).toFixed(2)} MB PAYLOAD</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{doc.users?.full_name || 'Anonymous Drop'}</span>
                        <span className="text-xs font-medium text-slate-400">{doc.users?.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ${
                        doc.processing_status === 'quarantined' ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 ring-amber-200' :
                        doc.processing_status === 'processed' ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 ring-emerald-200' :
                        doc.processing_status === 'failed' ? 'bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 ring-rose-200' :
                        'bg-slate-50 text-blue-700 ring-blue-200'
                      }`}>
                        {doc.processing_status}
                      </span>
                      {doc.copyright_flag && (
                         <span className="ml-2 inline-flex items-center text-[10px] uppercase font-black tracking-widest text-white bg-rose-500 px-2 py-1.5 rounded-md shadow-sm shadow-rose-500/30">
                           FLAGGED
                         </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-xs font-semibold text-slate-400">
                      {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <a
                          href={`/document/${doc.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-600 focus:bg-blue-100 hover:bg-blue-50 rounded-lg hover:scale-110 active:scale-95 transition-all"
                          title="Open Viewer Container"
                        >
                          <ExternalLink size={16} strokeWidth={2.5} />
                        </a>
                        
                        {doc.processing_status === 'quarantined' && (
                          <>
                            <button
                              onClick={() => handleAction('approve', doc.id, 'Document approved for processing')}
                              className="p-2 text-emerald-600 bg-emerald-50 shadow-sm ring-1 ring-emerald-200/50 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg hover:scale-110 active:scale-95 transition-all"
                              title="Bypass Quarantine (Approve)"
                            >
                              <CheckCircle size={16} strokeWidth={3} />
                            </button>
                            <button
                              onClick={() => handleAction('reject', doc.id, 'Document rejected')}
                              className="p-2 text-amber-600 bg-amber-50 shadow-sm ring-1 ring-amber-200/50 hover:bg-amber-100 hover:text-amber-700 rounded-lg hover:scale-110 active:scale-95 transition-all mx-1"
                              title="Enforce Quarantine (Reject)"
                            >
                              <XCircle size={16} strokeWidth={3} />
                            </button>
                          </>
                        )}
                        
                        <button
                          onClick={() => handleAction('force-delete', doc.id, 'Document force deleted')}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg hover:scale-110 active:scale-95 transition-all"
                          title="Erase Trace (Force Delete)"
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
           <p>INDEX {(page - 1) * 20 + (total > 0 ? 1 : 0)} TO {Math.min(page * 20, total)} OF {total}</p>
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

export default AdminDocuments;
