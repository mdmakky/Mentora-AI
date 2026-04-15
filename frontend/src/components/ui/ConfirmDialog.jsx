import { useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';

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
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen) confirmRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const dialog = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in border border-slate-100">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-7 pb-5 sm:px-7">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              confirmVariant === 'danger' ? 'bg-rose-50' : 'bg-amber-50'
            }`}
          >
            <AlertTriangle
              size={22}
              className={confirmVariant === 'danger' ? 'text-rose-500' : 'text-amber-500'}
            />
          </div>

          <h3 className="text-lg font-bold text-slate-900 mb-1.5 pr-8">{title}</h3>
          <p className="text-sm leading-relaxed text-slate-500 wrap-break-word">{message}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 px-6 pb-6 sm:px-7">
          <button
            onClick={onClose}
            className="py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={() => { onConfirm(); onClose(); }}
            className={`py-2.5 rounded-xl text-sm font-semibold text-white transition ${
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

  return createPortal(dialog, document.body);
};

export default ConfirmDialog;
