import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import useDocumentStore from '../../stores/documentStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const UploadModal = ({ isOpen, onClose, courseId, folderId }) => {
  const [file, setFile] = useState(null);
  const [declared, setDeclared] = useState(false);
  const [category, setCategory] = useState('lecture');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { uploading, uploadDocument } = useDocumentStore();

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setError('');
      setSuccess(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file) return setError('Please select a file');
    if (!declared) return setError('You must accept the anti-piracy declaration');

    setError('');
    const result = await uploadDocument(file, courseId, folderId, category);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1500);
    } else {
      setError(result.error || 'Upload failed');
    }
  };

  const handleReset = () => {
    setFile(null);
    setDeclared(false);
    setCategory('lecture');
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Document" maxWidth="520px">
      {success ? (
        <div className="text-center py-8 animate-scale-in">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-3" />
          <p className="text-lg font-semibold text-slate-900">Upload Successful!</p>
          <p className="text-sm text-slate-500 mt-1">Your document is being processed...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`upload-zone ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <FileText size={24} className="text-emerald-600" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 transition"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">
                  {isDragActive ? 'Drop your file here' : 'Drag & drop or click to browse'}
                </p>
                <p className="text-xs text-slate-400 mt-1">PDF, DOCX, PPTX · Max 50MB</p>
              </>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition bg-white"
            >
              <option value="lecture">Lecture Notes</option>
              <option value="assignment">Assignment</option>
              <option value="textbook">Textbook</option>
              <option value="exam">Exam Paper</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Anti-piracy declaration */}
          <label className="flex gap-3 items-start p-3 rounded-xl border border-amber-200 bg-amber-50 cursor-pointer">
            <input
              type="checkbox"
              checked={declared}
              onChange={(e) => setDeclared(e.target.checked)}
              className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-xs text-amber-800 leading-relaxed">
              I declare that this document is either my own work or I have the right to use it for personal study.
              I understand that copyrighted material may be flagged and removed.
            </span>
          </label>

          {error && (
            <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
            <Button size="sm" onClick={handleUpload} loading={uploading} disabled={!file || !declared}>
              <Upload size={15} /> Upload
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default UploadModal;
