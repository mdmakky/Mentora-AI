import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, FolderPlus, FileText, LayoutGrid, List, FlaskConical, Files,
} from 'lucide-react';
import useCourseStore from '../stores/courseStore';
import useDocumentStore from '../stores/documentStore';
import DocumentCard from '../components/documents/DocumentCard';
import FolderTree from '../components/documents/FolderTree';
import UploadModal from '../components/documents/UploadModal';
import QuestionLabSection from '../components/questions/QuestionLabSection';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';

const TABS = [
  { id: 'documents',    label: 'Documents',     icon: Files },
  { id: 'question-lab', label: 'Question Lab',  icon: FlaskConical },
];

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
  const [activeTab, setActiveTab] = useState('documents');

  const getCourse = useCourseStore((s) => s.getCourse);
  const { documents, folders, fetchDocuments, fetchFolders, createFolder, pollDocumentStatus } = useDocumentStore();
  const pollIntervalsRef = useRef([]);

  const startPollingPending = (docs) => {
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
      await Promise.all([fetchDocuments(courseId), fetchFolders(courseId)]);
      setLoading(false);
    };
    load();
    return () => { pollIntervalsRef.current.forEach(clearInterval); };
  }, [courseId, getCourse, fetchDocuments, fetchFolders]);

  useEffect(() => { startPollingPending(documents); }, [documents]);

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

  if (loading && !course) {
    return (
      <div className="app-content animate-pulse">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-200" />
            <div>
              <div className="w-16 h-3 bg-slate-200 rounded mb-2" />
              <div className="w-48 h-6 bg-slate-200 rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-20 h-8 bg-slate-200 rounded" />
            <div className="w-24 h-8 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="flex gap-6">
          <div className="w-52 shrink-0 space-y-2 hidden sm:block">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="w-full h-8 bg-slate-100 rounded" />)}
          </div>
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 bg-slate-100 border border-slate-100 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
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

  // On the Documents tab, hide question_paper category docs (they live in Question Lab)
  const filteredDocs = (activeFolder
    ? documents.filter((d) => d.folder_id === activeFolder)
    : documents
  ).filter((d) => d.doc_category !== 'question_paper');

  return (
    <div className="app-content animate-fade-in">
      {/* ── Course Header ── */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: course.color }} />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{course.course_code}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5 leading-tight wrap-break-word">
                {course.course_name}
              </h1>
              {course.instructor && (
                <p className="text-sm text-slate-500 mt-0.5">Instructor: {course.instructor}</p>
              )}
            </div>
          </div>

          {activeTab === 'documents' && (
            <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto flex-wrap">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setShowNewFolder(true)}>
                <FolderPlus size={15} /> Folder
              </Button>
              <Button size="sm" className="rounded-full" onClick={() => setShowUpload(true)}>
                <Upload size={15} /> Upload PDF
              </Button>
            </div>
          )}
        </div>

        {/* ── Tab Bar ── */}
        <div className="course-tab-bar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`course-tab ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={15} />
              {label}
              {id === 'question-lab' && (
                <span className="course-tab-badge">AI</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'documents' ? (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {folders.length > 0 && (
            <div className="w-full lg:w-52 shrink-0 card p-2 sm:p-3">
              <FolderTree folders={folders} activeFolder={activeFolder} onSelect={handleFolderSelect} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4 gap-3">
              <p className="text-sm text-slate-500 min-w-0">
                {filteredDocs.length} document{filteredDocs.length !== 1 && 's'}
                {activeFolder && (
                  <button onClick={() => handleFolderSelect(null)} className="ml-2 text-emerald-600 hover:text-emerald-700 font-medium">
                    Show all
                  </button>
                )}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setViewMode('grid')} className={`pdf-toolbar-btn w-9 h-9 ${viewMode === 'grid' ? 'active' : ''}`}>
                  <LayoutGrid size={16} />
                </button>
                <button onClick={() => setViewMode('list')} className={`pdf-toolbar-btn w-9 h-9 ${viewMode === 'list' ? 'active' : ''}`}>
                  <List size={16} />
                </button>
              </div>
            </div>

            {filteredDocs.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents yet"
                description="Upload your first PDF, DOCX, or PPTX file to start studying with AI."
                action={<Button onClick={() => setShowUpload(true)}><Upload size={16} /> Upload Document</Button>}
              />
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4' : 'space-y-2'}>
                {filteredDocs.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} viewMode={viewMode} courseId={courseId} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <QuestionLabSection courseId={courseId} course={course} />
      )}

      {/* Modals */}
      <UploadModal isOpen={showUpload} onClose={() => setShowUpload(false)} courseId={courseId} folderId={activeFolder} />

      <Modal isOpen={showNewFolder} onClose={() => setShowNewFolder(false)} title="Create Folder">
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Folder Name</label>
            <input
              type="text" required placeholder="Lecture Notes" value={folderName}
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
