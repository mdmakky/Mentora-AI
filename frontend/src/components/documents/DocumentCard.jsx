import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, CheckCircle, AlertTriangle, Loader2, RefreshCw, ShieldQuestion } from 'lucide-react';
import useDocumentStore from '../../stores/documentStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const statusConfig = {
  pending: { label: 'Processing', icon: Loader2, cls: 'badge-warning', spin: true },
  processing: { label: 'Processing', icon: Loader2, cls: 'badge-warning', spin: true },
  ready: { label: 'Ready', icon: CheckCircle, cls: 'badge-success' },
  quarantined: { label: 'Flagged', icon: AlertTriangle, cls: 'badge-danger' },
  failed: { label: 'Failed', icon: AlertTriangle, cls: 'badge-danger' },
};

const typeIcons = {
  pdf: '📄',
  docx: '📝',
  pptx: '📊',
};

const formatSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DocumentCard = ({ doc, viewMode = 'grid', courseId }) => {
  const navigate = useNavigate();
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);
  const rescanDocument = useDocumentStore((s) => s.rescanDocument);
  const requestDocumentReview = useDocumentStore((s) => s.requestDocumentReview);
  const status = statusConfig[doc.processing_status] || statusConfig.pending;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [rescanLoading, setRescanLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const handleClick = () => {
    if (doc.processing_status === 'ready') {
      navigate(`/document/${doc.id}`);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    await deleteDocument(doc.id);
  };

  const canRescan = doc.processing_status === 'quarantined' || doc.processing_status === 'failed';
  const reviewPending = doc.review_status === 'pending';

  const handleRescan = async (e) => {
    e.stopPropagation();
    setActionError('');
    setRescanLoading(true);
    const result = await rescanDocument(doc.id);
    setRescanLoading(false);
    if (!result.success) {
      setActionError(result.error || 'Rescan failed');
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setActionError('');
    setReviewLoading(true);
    const result = await requestDocumentReview(doc.id, reviewNote.trim());
    setReviewLoading(false);
    if (!result.success) {
      setActionError(result.error || 'Could not submit review request');
      return;
    }
    setReviewModalOpen(false);
    setReviewNote('');
  };

  if (viewMode === 'list') {
    return (
      <div
        onClick={handleClick}
        className={`card flex items-center gap-4 px-4 py-3 group ${
          doc.processing_status === 'ready' ? 'card-interactive cursor-pointer' : 'opacity-75'
        }`}
      >
        <span className="text-xl">{typeIcons[doc.file_type] || '📄'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-emerald-700 transition">
            {doc.file_name}
          </p>
          <p className="text-xs text-slate-500">
            {formatSize(doc.file_size)} · {doc.page_count} pages
          </p>
        </div>
        <span className={`badge ${status.cls} text-[10px]`}>
          {status.spin ? <Loader2 size={10} className="animate-spin mr-1" /> : <status.icon size={10} className="mr-1" />}
          {status.label}
        </span>
        {canRescan && (
          <button
            onClick={handleRescan}
            disabled={rescanLoading}
            className="px-2 py-1 rounded-md text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition"
            title="Rescan this document"
          >
            {rescanLoading ? 'Rescanning...' : 'Rescan'}
          </button>
        )}
        {canRescan && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setReviewModalOpen(true);
            }}
            disabled={reviewPending}
            className="px-2 py-1 rounded-md text-[10px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition disabled:opacity-60"
            title="Request manual admin review"
          >
            {reviewPending ? 'Review Pending' : 'Request Review'}
          </button>
        )}
        <button
          onClick={handleDelete}
          className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 w-7 h-7 rounded-md flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={handleClick}
        className={`card overflow-hidden group ${
          doc.processing_status === 'ready' ? 'card-interactive cursor-pointer' : 'opacity-75'
        }`}
      >
        {/* Preview area */}
        <div className="h-32 bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center relative">
          <span className="text-4xl">{typeIcons[doc.file_type] || '📄'}</span>
          <span className={`badge ${status.cls} absolute top-2 right-2 text-[10px]`}>
            {status.spin ? <Loader2 size={10} className="animate-spin mr-1" /> : <status.icon size={10} className="mr-1" />}
            {status.label}
          </span>
        </div>

        <div className="p-3 sm:p-3.5">
          <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-emerald-700 transition mb-1">
            {doc.file_name}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {formatSize(doc.file_size)} · {doc.page_count} pg
            </p>
            <div className="flex items-center gap-1.5">
              {canRescan && (
                <button
                  onClick={handleRescan}
                  disabled={rescanLoading}
                  className="w-6 h-6 rounded flex items-center justify-center text-amber-500 hover:text-amber-700 transition"
                  title="Rescan"
                >
                  <RefreshCw size={13} className={rescanLoading ? 'animate-spin' : ''} />
                </button>
              )}
              {canRescan && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReviewModalOpen(true);
                  }}
                  disabled={reviewPending}
                  className="w-6 h-6 rounded flex items-center justify-center text-violet-500 hover:text-violet-700 transition disabled:opacity-60"
                  title={reviewPending ? 'Review already pending' : 'Request admin review'}
                >
                  <ShieldQuestion size={13} />
                </button>
              )}
              <button
                onClick={handleDelete}
                className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-rose-500 transition"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          {doc.flag_reason && canRescan && (
            <p className="mt-2 text-[10px] text-rose-500 line-clamp-2" title={doc.flag_reason}>{doc.flag_reason}</p>
          )}
          {actionError && (
            <p className="mt-2 text-[10px] text-rose-500 line-clamp-2" title={actionError}>{actionError}</p>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Document?"
        message={`"${doc.file_name}" will be permanently deleted along with all its AI data.`}
        confirmLabel="Delete"
      />

      <Modal isOpen={reviewModalOpen} onClose={() => setReviewModalOpen(false)} title="Request Admin Review">
        <form onSubmit={handleSubmitReview} className="space-y-4">
          <p className="text-sm text-slate-600">
            If you think this flag is a false positive, submit a note for admin verification.
          </p>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Explain why this should be accepted..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 transition"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setReviewModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={reviewLoading}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default DocumentCard;
