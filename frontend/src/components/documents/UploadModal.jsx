import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, AlertCircle, X, FileQuestion } from 'lucide-react';
import useDocumentStore from '../../stores/documentStore';
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
  
  const [files, setFiles] = useState([]);
  const [declared, setDeclared] = useState(isQuestionPaper); // Auto-declare for question papers
  const [category, setCategory] = useState(forceCategory || 'lecture');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { uploading, uploadDocument } = useDocumentStore();

  const effectiveCategory = forceCategory || category;

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) {
      setFiles((prev) => {
        const newFiles = isQuestionPaper ? [...prev, ...accepted] : [accepted[0]];
        return newFiles.slice(0, 10); // Cap at 10 files
      });
      setError('');
      setSuccess(false);
    }
  }, [isQuestionPaper]);

  const onDropRejected = useCallback((rejected) => {
    if (rejected.length > 0) {
      setError(`Rejected file: ${rejected[0].file.name}. Ensure it's a valid format and under 50MB.`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: true,
  });

  const removeFile = (indexToRemove, e) => {
    e.stopPropagation();
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpload = async () => {
    if (files.length === 0) return setError('Please select a file');
    if (!declared) return setError('You must accept the anti-piracy declaration');
    setError('');
    
    // Upload files sequentially
    let hasError = false;
    for (const file of files) {
      const result = await uploadDocument(file, courseId, folderId, effectiveCategory);
      if (!result.success) {
        setError(result.error || `Upload failed for ${file.name}`);
        hasError = true;
        break; // Stop uploading if one fails
      }
    }

    if (!hasError) {
      setSuccess(true);
      setTimeout(() => { handleReset(); onClose(); }, 1500);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setDeclared(isQuestionPaper);
    setCategory(forceCategory || 'lecture');
    setError('');
    setSuccess(false);
  };

  const handleClose = () => { handleReset(); onClose(); };

  const modalTitle = isQuestionPaper ? 'Upload Past Question Paper' : 'Upload Document';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} maxWidth="520px">
      {success ? (
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
                  PDF, DOCX, PPTX, JPG, PNG · Max 50MB
                  {isQuestionPaper ? ' (Up to 10 files)' : ''}
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
            <Button size="sm" onClick={handleUpload} loading={uploading} disabled={files.length === 0 || !declared}>
              <Upload size={15} /> Upload {files.length > 1 ? `(${files.length})` : ''}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default UploadModal;
