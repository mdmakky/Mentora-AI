import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, FolderPlus, FileText, LayoutGrid, List,
} from 'lucide-react';
import useCourseStore from '../stores/courseStore';
import useDocumentStore from '../stores/documentStore';
import DocumentCard from '../components/documents/DocumentCard';
import FolderTree from '../components/documents/FolderTree';
import UploadModal from '../components/documents/UploadModal';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

const CourseView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [activeFolder, setActiveFolder] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  const getCourse = useCourseStore((s) => s.getCourse);
  const { documents, folders, fetchDocuments, fetchFolders, createFolder, pollDocumentStatus } = useDocumentStore();
  const pollIntervalsRef = useRef([]);

  // Start polling for documents that are still processing
  const startPollingPending = (docs) => {
    // Clear old intervals
    pollIntervalsRef.current.forEach(clearInterval);
    pollIntervalsRef.current = [];
    
    (docs || []).forEach((doc) => {
      if (doc.processing_status === 'pending' || doc.processing_status === 'processing') {
        const interval = pollDocumentStatus(doc.id);
        pollIntervalsRef.current.push(interval);
      }
    });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const c = await getCourse(courseId);
      setCourse(c);
      await Promise.all([
        fetchDocuments(courseId),
        fetchFolders(courseId),
      ]);
      setLoading(false);
    };
    load();

    return () => {
      pollIntervalsRef.current.forEach(clearInterval);
    };
  }, [courseId, getCourse, fetchDocuments, fetchFolders]);

  // Whenever documents change, start polling for any pending ones
  useEffect(() => {
    startPollingPending(documents);
  }, [documents]);

  const handleFolderSelect = (folderId) => {
    setActiveFolder(folderId);
    fetchDocuments(courseId, folderId);
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    await createFolder({ course_id: courseId, name: folderName, parent_id: activeFolder });
    setShowNewFolder(false);
    setFolderName('');
  };

  if (loading) {
    return (
      <div className="app-content flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="app-content">
        <EmptyState
          icon={FileText}
          title="Course not found"
          description="This course may have been deleted."
          action={<Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>}
        />
      </div>
    );
  }

  const filteredDocs = activeFolder
    ? documents.filter((d) => d.folder_id === activeFolder)
    : documents;

  return (
    <div className="app-content animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: course.color }}
              />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {course.course_code}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">{course.course_name}</h1>
            {course.instructor && (
              <p className="text-sm text-slate-500 mt-0.5">Instructor: {course.instructor}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowNewFolder(true)}>
            <FolderPlus size={15} /> Folder
          </Button>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Upload size={15} /> Upload PDF
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex gap-6">
        {/* Folder sidebar */}
        {folders.length > 0 && (
          <div className="w-52 flex-shrink-0">
            <FolderTree
              folders={folders}
              activeFolder={activeFolder}
              onSelect={handleFolderSelect}
            />
          </div>
        )}

        {/* Documents */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              {filteredDocs.length} document{filteredDocs.length !== 1 && 's'}
              {activeFolder && (
                <button
                  onClick={() => handleFolderSelect(null)}
                  className="ml-2 text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Show all
                </button>
              )}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`pdf-toolbar-btn ${viewMode === 'grid' ? 'active' : ''}`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`pdf-toolbar-btn ${viewMode === 'list' ? 'active' : ''}`}
              >
                <List size={16} />
              </button>
            </div>
          </div>

          {/* Document grid/list */}
          {filteredDocs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Upload your first PDF, DOCX, or PPTX file to start studying with AI."
              action={
                <Button onClick={() => setShowUpload(true)}>
                  <Upload size={16} /> Upload Document
                </Button>
              }
            />
          ) : (
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-2'
            }>
              {filteredDocs.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} viewMode={viewMode} courseId={courseId} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        courseId={courseId}
        folderId={activeFolder}
      />

      {/* New Folder Modal */}
      <Modal isOpen={showNewFolder} onClose={() => setShowNewFolder(false)} title="Create Folder">
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Folder Name</label>
            <input
              type="text"
              required
              placeholder="Lecture Notes"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowNewFolder(false)}>Cancel</Button>
            <Button size="sm" type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CourseView;
