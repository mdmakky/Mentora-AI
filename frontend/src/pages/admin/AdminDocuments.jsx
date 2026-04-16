import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileWarning, CheckCircle, XCircle, Trash2, ExternalLink, MessageSquare, AlertTriangle, FileText, Eye } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';

// ── Helpers ───────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    quarantined: 'bg-amber-50 text-amber-700 ring-amber-200',
    processed:   'bg-green-50 text-green-700 ring-green-200',
    failed:      'bg-red-50 text-red-700 ring-red-200',
    pending:     'bg-sky-50 text-sky-700 ring-sky-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ring-1 capitalize ${map[status] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
      {status}
    </span>
  );
};

const openAdminPdf = async (docId) => {
  const toastId = toast.loading('Loading document…');
  try {
    const data = await apiClient.get(`/admin/documents/${docId}/signed-url`);
    toast.dismiss(toastId);
    window.open(data.url, '_blank', 'noreferrer');
  } catch {
    toast.dismiss(toastId);
    toast.error('Could not load document.');
  }
};

// ── Review Appeal Card ────────────────────────────────────────────────────────
const ReviewCard = ({ doc, onApprove, onReject, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const note = doc.review_note || '';

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Top row */}
      <div className="flex items-start gap-4 px-5 py-4">
        <span className="mt-0.5 flex-shrink-0 text-[11px] font-bold text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 uppercase">
          {doc.file_type}
        </span>

        <div className="flex-1 min-w-0">
          {/* File + user */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate" title={doc.file_name}>{doc.file_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {doc.users?.full_name || 'Unknown'} &middot; {doc.users?.email} &middot;{' '}
                {new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {doc.copyright_flag && (
                <span className="text-[10px] font-semibold uppercase text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                  Copyright
                </span>
              )}
              <StatusBadge status={doc.processing_status} />
            </div>
          </div>

          {/* Flag reason */}
          {doc.flag_reason && (
            <div className="mt-3 flex items-start gap-2 border-l-2 border-amber-300 pl-3 py-1">
              <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" strokeWidth={2} />
              <p className="text-xs text-gray-600">
                <span className="font-semibold text-gray-700">Flag: </span>{doc.flag_reason}
              </p>
            </div>
          )}

          {/* Appeal message */}
          <div className="mt-3 flex items-start gap-2 border-l-2 border-gray-200 pl-3 py-1">
            <MessageSquare size={13} className="text-gray-400 shrink-0 mt-0.5" strokeWidth={1.5} />
            {note ? (
              <p className="text-xs text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-700">User appeal: </span>
                {expanded ? note : note.slice(0, 140)}
                {note.length > 140 && (
                  <button onClick={() => setExpanded(e => !e)} className="ml-1 text-gray-400 hover:text-gray-600 underline underline-offset-2">
                    {expanded ? 'less' : 'more'}
                  </button>
                )}
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic">No appeal message provided.</p>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => openAdminPdf(doc.id)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
        >
          <Eye size={13} /> View document
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onApprove(doc)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-green-200 text-xs font-semibold text-green-700 bg-white hover:bg-green-50 transition-colors"
          >
            <CheckCircle size={13} strokeWidth={2} /> Approve
          </button>
          <button
            onClick={() => onReject(doc)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 transition-colors"
          >
            <XCircle size={13} strokeWidth={2} /> Reject
          </button>
          <button
            onClick={() => onDelete(doc.id)}
            title="Force delete"
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const AdminDocuments = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'quarantined';
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(tabFromUrl);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => { setStatusFilter(tabFromUrl); setPage(1); }, [tabFromUrl]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      if (statusFilter === 'review_pending') {
        const data = await apiClient.get('/admin/documents/review-requests');
        setDocuments(data || []);
        setTotal((data || []).length);
      } else {
        const q = new URLSearchParams({ page, per_page: 20 });
        if (statusFilter) q.append('status', statusFilter);
        const data = await apiClient.get(`/admin/documents?${q}`);
        setDocuments(data.documents || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocuments(); }, [statusFilter, page]);

  const openReviewModal = (doc, decision) => { setReviewModal({ doc, decision }); setReviewNote(''); };

  const submitReview = async () => {
    if (!reviewNote.trim()) { toast.error('Please write a decision note.'); return; }
    setReviewSubmitting(true);
    try {
      const { doc, decision } = reviewModal;
      await apiClient.put(`/admin/documents/${doc.id}/review`, { decision, note: reviewNote.trim() });
      toast.success(decision === 'approve' ? 'Appeal approved — document unlocked' : 'Appeal rejected — penalty applied');
      setReviewModal(null);
      fetchDocuments();
    } catch (e) {
      toast.error(e.message || 'Failed to submit decision');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleAction = async (action, docId, msg) => {
    try {
      if (action === 'force-delete') {
        if (!window.confirm('Permanently delete this document?')) return;
        await apiClient.delete(`/admin/documents/${docId}/force-delete`);
      } else if (action === 'reject') {
        const warn = window.confirm('Add a copyright violation warning to the user?');
        await apiClient.put(`/admin/documents/${docId}/reject`, { warn_user: warn, suspend_user_flag: false });
      } else {
        await apiClient.put(`/admin/documents/${docId}/${action}`);
      }
      toast.success(msg);
      fetchDocuments();
    } catch (e) {
      toast.error(e.message || `Action failed`);
    }
  };

  const TABS = [
    { key: 'quarantined',    label: 'Quarantined' },
    { key: 'review_pending', label: 'Review Queue' },
    { key: 'pending',        label: 'Pending' },
    { key: 'processed',      label: 'Processed' },
    { key: '',               label: 'All' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 pb-1">
        <FileWarning size={20} className="text-gray-500" strokeWidth={1.5} />
        <div>
          <h1 className="text-lg font-bold text-gray-800">Document Management</h1>
          <p className="text-xs text-gray-400">Review flagged content and action user appeals</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap border-b border-gray-100 pb-4">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="text-gray-400" /></div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={28} className="text-gray-300 mb-3" strokeWidth={1} />
          <p className="text-sm font-medium text-gray-500">No documents found</p>
          <p className="text-xs text-gray-400 mt-0.5">Nothing to show under this filter.</p>
        </div>
      ) : statusFilter === 'review_pending' ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">{total} appeal{total !== 1 ? 's' : ''} awaiting review</p>
          {documents.map(doc => (
            <ReviewCard key={doc.id} doc={doc}
              onApprove={d => openReviewModal(d, 'approve')}
              onReject={d => openReviewModal(d, 'reject')}
              onDelete={id => handleAction('force-delete', id, 'Document deleted')}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Document</th>
                <th className="px-4 py-3 text-left">Owner</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold text-gray-400 border border-gray-200 rounded px-1 py-0.5 uppercase shrink-0">
                        {doc.file_type}
                      </span>
                      <div>
                        <p className="font-medium text-gray-800 truncate max-w-[220px]" title={doc.file_name}>{doc.file_name}</p>
                        {doc.flag_reason && (
                          <p className="text-[11px] text-amber-500 truncate max-w-[200px]" title={doc.flag_reason}>⚠ {doc.flag_reason}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-gray-700">{doc.users?.full_name || '—'}</p>
                    <p className="text-xs text-gray-400">{doc.users?.email}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1 items-start">
                      <StatusBadge status={doc.processing_status} />
                      {doc.copyright_flag && (
                        <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 uppercase">
                          Copyright
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">
                    {new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openAdminPdf(doc.id)}
                        className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="View document">
                        <Eye size={14} strokeWidth={1.5} />
                      </button>
                      {doc.processing_status === 'quarantined' && <>
                        <button onClick={() => handleAction('approve', doc.id, 'Document approved')}
                          className="p-1.5 rounded text-green-500 hover:bg-green-50 transition-colors" title="Approve">
                          <CheckCircle size={14} strokeWidth={2} />
                        </button>
                        <button onClick={() => handleAction('reject', doc.id, 'Document rejected')}
                          className="p-1.5 rounded text-amber-500 hover:bg-amber-50 transition-colors" title="Reject">
                          <XCircle size={14} strokeWidth={2} />
                        </button>
                      </>}
                      <button onClick={() => handleAction('force-delete', doc.id, 'Document deleted')}
                        className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Force delete">
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">{(page-1)*20+(total>0?1:0)}–{Math.min(page*20,total)} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                Prev
              </button>
              <button onClick={() => setPage(p => p+1)} disabled={page*20>=total}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Decision Modal */}
      {reviewModal && (
        <Modal isOpen={true} onClose={() => setReviewModal(null)}
          title={reviewModal.decision === 'approve' ? 'Approve Appeal' : 'Reject Appeal'}
          maxWidth="560px">
          <div className="space-y-4">

            {/* Doc summary */}
            <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{reviewModal.doc.file_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{reviewModal.doc.users?.full_name} · {reviewModal.doc.users?.email}</p>
              </div>
              <button onClick={() => openAdminPdf(reviewModal.doc.id)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors whitespace-nowrap">
                <ExternalLink size={12} /> View PDF
              </button>
            </div>

            {/* Flag reason */}
            {reviewModal.doc.flag_reason && (
              <div className="flex items-start gap-2.5 border-l-2 border-amber-300 pl-3 py-1.5">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-0.5">Why it was flagged</p>
                  <p className="text-sm text-gray-700">{reviewModal.doc.flag_reason}</p>
                </div>
              </div>
            )}

            {/* User's appeal */}
            <div className="border-l-2 border-gray-200 pl-3 py-1.5">
              <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5">
                <MessageSquare size={12} strokeWidth={1.5} /> User's appeal
              </p>
              {reviewModal.doc.review_note ? (
                <p className="text-sm text-gray-700 leading-relaxed">"{reviewModal.doc.review_note}"</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No message provided.</p>
              )}
            </div>

            {/* Decision note */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Your decision note <span className="text-red-400">*</span>
              </label>
              <textarea rows={3} value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                placeholder={reviewModal.decision === 'approve'
                  ? 'e.g. Reviewed — original work confirmed, no violation found.'
                  : 'e.g. Confirmed copyright match. Violation stands.'}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
              />
              <p className="mt-1 text-xs text-gray-400">This note is included in the notification sent to the user.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => setReviewModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={submitReview} disabled={reviewSubmitting || !reviewNote.trim()}
                className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                  reviewModal.decision === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}>
                {reviewSubmitting ? 'Saving…' : reviewModal.decision === 'approve' ? 'Approve & Unlock' : 'Reject & Penalise'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminDocuments;
