import { useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Delete',
  confirmVariant = 'danger', // 'danger' | 'warning'
}) => {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (isOpen) confirmRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in">
        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
            confirmVariant === 'danger' ? 'bg-rose-50' : 'bg-amber-50'
          }`}>
            <AlertTriangle size={22} className={
              confirmVariant === 'danger' ? 'text-rose-500' : 'text-amber-500'
            } />
          </div>

          <h3 className="text-lg font-bold text-slate-900 text-center mb-2">{title}</h3>
          <p className="text-sm text-slate-500 text-center">{message}</p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition ${
              confirmVariant === 'danger'
                ? 'bg-rose-500 hover:bg-rose-600'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
