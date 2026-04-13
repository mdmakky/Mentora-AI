import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import useDocumentStore from '../../stores/documentStore';
import ConfirmDialog from '../ui/ConfirmDialog';

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
  const status = statusConfig[doc.processing_status] || statusConfig.pending;
  const [confirmOpen, setConfirmOpen] = useState(false);

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
            <button
              onClick={handleDelete}
              className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-rose-500 transition"
            >
              <Trash2 size={13} />
            </button>
          </div>
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
    </>
  );
};

export default DocumentCard;
