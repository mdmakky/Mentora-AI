import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PanelRightOpen, PanelRightClose } from 'lucide-react';
import useDocumentStore from '../stores/documentStore';
import PDFViewer from '../components/pdf/PDFViewer';
import ChatPanel from '../components/chat/ChatPanel';
import Spinner from '../components/ui/Spinner';
import useStudySessionTracker from '../utils/useStudySessionTracker';

const DocumentView = () => {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [targetPage, setTargetPage] = useState(null);
  const { currentDoc, getDocument, getDocumentUrl, clearCurrentDoc } = useDocumentStore();

  useStudySessionTracker({
    enabled: Boolean(currentDoc?.id),
    courseId: currentDoc?.course_id || null,
    documentId: currentDoc?.id || null,
    sessionType: 'reading',
  });

  useEffect(() => {
    let objectUrl = null;
    const load = async () => {
      setLoading(true);
      const doc = await getDocument(docId);
      if (doc) {
        const url = await getDocumentUrl(docId);
        if (url && url.startsWith('blob:')) objectUrl = url;
        setPdfUrl(url || doc.cloudinary_url);
      }
      setLoading(false);
    };
    load();
    return () => {
      clearCurrentDoc();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docId, getDocument, getDocumentUrl, clearCurrentDoc]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (event) => {
      setIsMobile(event.matches);
      if (event.matches) {
        setChatOpen(false);
      }
    };

    onChange(mq);
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  const handleCitationClick = (pageNumber) => {
    setTargetPage(pageNumber);
    // Reset after a tick so the same page can be clicked again
    setTimeout(() => setTargetPage(null), 100);
  };

  if (loading) {
    return (
      <div className="doc-view animate-pulse">
        <div className="doc-view-pdf flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-200" />
              <div className="w-48 h-4 bg-slate-200 rounded" />
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-200" />
          </div>
          <div className="flex-1 bg-slate-100 flex items-center justify-center">
            <div className="w-24 h-6 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="doc-view-chat bg-white border-l border-slate-200 p-4 space-y-4">
          <div className="h-8 w-3/4 bg-slate-200 rounded-lg" />
          <div className="space-y-3 pt-4">
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="h-24 bg-slate-100 rounded-xl ml-8" />
            <div className="h-16 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!currentDoc || !pdfUrl) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700 mb-2">Document not found</p>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="doc-view">
      {/* PDF Viewer */}
      <div className="doc-view-pdf">
        {/* Mini toolbar for back + chat toggle */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <p className="text-sm font-semibold text-slate-800 truncate">
              {currentDoc.file_name}
            </p>
          </div>
          {isMobile ? (
            <span className="text-[10px] font-medium text-slate-400 shrink-0">Chat off on mobile</span>
          ) : (
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="pdf-toolbar-btn shrink-0"
              title={chatOpen ? 'Hide chat' : 'Show chat'}
            >
              {chatOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
          )}
        </div>

        <PDFViewer url={pdfUrl} targetPage={targetPage} />
      </div>

      {/* Chat Panel */}
      <div className={`doc-view-chat ${!chatOpen || isMobile ? 'collapsed' : ''}`}>
        {chatOpen && !isMobile && (
          <ChatPanel
            key={currentDoc.id}
            courseId={currentDoc.course_id}
            documentId={currentDoc.id}
            documentName={currentDoc.file_name}
            onCitationClick={handleCitationClick}
          />
        )}
      </div>
    </div>
  );
};

export default DocumentView;
