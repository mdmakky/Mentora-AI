import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, AlertCircle, X, FileQuestion, Lock, Clock, Send, MessageSquare } from 'lucide-react';
import useDocumentStore from '../../stores/documentStore';
import useAuthStore from '../../stores/authStore';
import { apiClient } from '../../lib/apiClient';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const CATEGORIES = [
  { value: 'lecture',       label: 'Lecture Notes' },
  { value: 'assignment',    label: 'Assignment' },
  { value: 'textbook',      label: 'Textbook' },
  { value: 'exam',          label: 'Exam Paper (general)' },
  { value: 'question_paper',label: '📄 Past Question Paper  (for Question Lab)' },
  { value: 'other',         label: 'Other' },
];

/**
 * UploadModal
 * Props:
 *  - forceCategory: if provided, locks the category selector to this value
 *    (used when opened from Question Lab to pre-select 'question_paper')
 */
const UploadModal = ({ isOpen, onClose, courseId, folderId, forceCategory }) => {
  const isQuestionPaper = forceCategory === 'question_paper';
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [freshSuspended, setFreshSuspended] = useState(null); // null = not checked yet
  const [freshSuspendedAt, setFreshSuspendedAt] = useState(null);
  const isSuspended = freshSuspended ?? !!user?.is_upload_suspended;
  const suspendedAt = freshSuspendedAt ?? user?.upload_suspended_at ?? null;

  // Fetch fresh suspension status every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setFreshSuspended(null);
    setFreshSuspendedAt(null);
    refreshUser().then(() => {
      // After refreshUser, the store is updated; read from store via useAuthStore
    });
    apiClient.get('/auth/me').then(data => {
      setFreshSuspended(!!data?.is_upload_suspended);
      setFreshSuspendedAt(data?.upload_suspended_at ?? null);
    }).catch(() => {});
  }, [isOpen]);

  // Appeal state
  const [appeal, setAppeal] = useState(undefined); // undefined=loading, null=none, object=appeal
  const [appealMsg, setAppealMsg] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealError, setAppealError] = useState('');
  const [appealDone, setAppealDone] = useState(false);

  // Fetch existing appeal when modal opens and user is suspended
  useEffect(() => {
    if (!isOpen || !isSuspended) return;
    setAppeal(undefined);
    apiClient.get('/appeals/suspension/my')
      .then(data => setAppeal(data || null))
      .catch(() => setAppeal(null));
  }, [isOpen, isSuspended]);

  // Compute days remaining using fresh suspendedAt
  const getDaysRemaining = () => {
    if (!suspendedAt) return null;
    const liftAt = new Date(new Date(suspendedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const days = Math.ceil((liftAt - new Date()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };
  const daysRemaining = getDaysRemaining();

  const submitAppeal = async () => {
    if (!appealMsg.trim() || appealMsg.trim().length < 10) {
      setAppealError('Please write at least 10 characters explaining your situation.');
      return;
    }
    setAppealSubmitting(true);
    setAppealError('');
    try {
      await apiClient.post('/appeals/suspension', { message: appealMsg.trim() });
      setAppealDone(true);
      setAppeal({ status: 'pending' });
    } catch (e) {
      setAppealError(e.message || 'Failed to submit appeal');
    } finally {
      setAppealSubmitting(false);
    }
  };

  const [files, setFiles] = useState([]);
  const [declared, setDeclared] = useState(isQuestionPaper); // Auto-declare for question papers
  const [category, setCategory] = useState(forceCategory || 'lecture');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { startUploadBackground } = useDocumentStore();

  const effectiveCategory = forceCategory || category;

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) {
      setFiles((prev) => {
        const combined = [...prev, ...accepted];
        return combined.slice(0, 10); // Cap at 10 files
      });
      setError('');
      setSuccess(false);
    }
  }, []);

  const onDropRejected = useCallback((rejected) => {
    if (rejected.length === 0) return;
    const file = rejected[0].file;
    setError(`Rejected file: ${file.name}. Ensure it's a valid format (PDF, DOCX, PPT, PPTX, JPG, PNG) and under 10MB.`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
  });

  const removeFile = (indexToRemove, e) => {
    e.stopPropagation();
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpload = () => {
    if (files.length === 0) return setError('Please select a file');
    if (!declared) return setError('You must accept the anti-piracy declaration');
    // Close the modal immediately — uploads run in the background.
    // Each file gets a placeholder card in the course view showing upload progress.
    const filesToUpload = [...files];
    handleReset();
    onClose();
    for (const file of filesToUpload) {
      startUploadBackground(file, courseId, folderId, effectiveCategory);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setDeclared(isQuestionPaper);
    setCategory(forceCategory || 'lecture');
    setError('');
    setSuccess(false);
    setFreshSuspended(null);
    setFreshSuspendedAt(null);
    setAppeal(undefined);
    setAppealMsg('');
    setAppealError('');
    setAppealDone(false);
  };

  const handleClose = () => { handleReset(); onClose(); };

  const modalTitle = isQuestionPaper ? 'Upload Past Question Paper' : 'Upload Document';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} maxWidth="520px">
      {/* ── Suspended screen ── */}
      {isSuspended ? (
        <div className="space-y-4 py-2">
          {/* Header */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <Lock size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">Upload access suspended</p>
              <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
                Your account has been suspended from uploading documents due to a policy violation.
              </p>
            </div>
          </div>

          {/* Auto-lift countdown */}
          {daysRemaining !== null && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50">
              <Clock size={15} className="text-slate-400 shrink-0" />
              {daysRemaining === 0 ? (
                <p className="text-xs text-slate-600">Auto-lift applies on your <strong>next upload attempt</strong>. Try uploading again.</p>
              ) : (
                <p className="text-xs text-slate-600">
                  Suspension auto-lifts in <strong className="text-slate-800">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</strong> if no action is taken.
                </p>
              )}
            </div>
          )}

          {/* Appeal section */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <MessageSquare size={14} className="text-slate-500" />
              <p className="text-xs font-bold text-slate-700">Appeal to Admin</p>
            </div>
            <div className="px-4 py-4">
              {appeal === undefined ? (
                <p className="text-xs text-slate-400 text-center py-2">Loading…</p>
              ) : appeal?.status === 'pending' ? (
                <div className="flex items-start gap-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <Clock size={13} className="shrink-0 mt-0.5" />
                  <span>Your appeal is <strong>under review</strong>. We'll notify you when a decision is made.</span>
                </div>
              ) : appeal?.status === 'rejected' ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Previous appeal was rejected</p>
                      {appeal.admin_response && <p className="mt-0.5 text-rose-600">{appeal.admin_response}</p>}
                    </div>
                  </div>
                  {daysRemaining !== null && daysRemaining > 0 && (
                    <p className="text-xs text-slate-500 text-center">You may wait for the auto-lift or submit a new request through the contact form.</p>
                  )}
                </div>
              ) : appealDone ? (
                <div className="flex items-center gap-2.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                  <CheckCircle size={13} className="shrink-0" />
                  <span>Appeal submitted! The admin will review it shortly.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Explain your situation and why you believe the suspension should be lifted.</p>
                  <textarea
                    value={appealMsg}
                    onChange={e => { setAppealMsg(e.target.value); setAppealError(''); }}
                    placeholder="e.g. I uploaded my own lecture notes. The copyright flag was a false positive…"
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none"
                  />
                  {appealError && (
                    <p className="text-xs text-rose-600 flex items-center gap-1.5"><AlertCircle size={12} />{appealError}</p>
                  )}
                  <button
                    onClick={submitAppeal}
                    disabled={appealSubmitting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition disabled:opacity-50"
                  >
                    <Send size={13} />
                    {appealSubmitting ? 'Submitting…' : 'Submit Appeal'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleClose}>Close</Button>
          </div>
        </div>
      ) : success ? (
        <div className="text-center py-8 animate-scale-in">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-3" />
          <p className="text-lg font-semibold text-slate-900">Upload Successful!</p>
          <p className="text-sm text-slate-500 mt-1">Your document{files.length > 1 ? 's are' : ' is'} being processed…</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Question paper hint */}
          {isQuestionPaper && (
            <div className="flex gap-3 items-start p-3 rounded-xl border border-blue-200 bg-blue-50">
              <FileQuestion size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800 leading-relaxed">
                Upload up to <strong>10 scanned images</strong> (.png, .jpg) or a PDF for a past exam. The AI reads tables, marks, and boxes directly from the image — no manual text extraction needed.
              </p>
            </div>
          )}

          {/* Drop zone */}
          <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} multiple={true} />
            {files.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto w-full">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 justify-between bg-white p-2 rounded-lg border border-slate-100 shadow-sm mx-auto w-full max-w-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText size={20} className="text-emerald-600 shrink-0" />
                      <div className="text-left overflow-hidden">
                        <p className="text-sm font-semibold text-slate-900 truncate" title={file.name}>{file.name}</p>
                        <p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => removeFile(idx, e)}
                      title="Remove file"
                      className="w-6 h-6 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <Upload size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">
                  {isDragActive ? 'Drop your files here' : 'Drag & drop or click to browse'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  PDF, DOCX, PPTX, JPG, PNG · Max 50MB · Up to 10 files
                </p>
              </>
            )}
          </div>

          {/* Category selector — hidden when forceCategory is set */}
          {!forceCategory && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Anti-piracy declaration (Hidden for question_paper) */}
          {!isQuestionPaper && (
            <label className="flex gap-3 items-start p-3 rounded-xl border border-amber-200 bg-amber-50 cursor-pointer">
              <input
                type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)}
                className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-xs text-amber-800 leading-relaxed">
                I declare that this document is either my own work or I have the right to use it for personal study.
                I understand that copyrighted material may be flagged and removed.
              </span>
            </label>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
            <Button size="sm" onClick={handleUpload} disabled={files.length === 0 || !declared}>
              <Upload size={15} /> Upload {files.length > 1 ? `(${files.length})` : ''}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default UploadModal;
