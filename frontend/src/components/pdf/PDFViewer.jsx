import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import PDFToolbar from './PDFToolbar';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDFViewer = ({ url, targetPage }) => {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const containerRef = useRef(null);
  const pageRefs = useRef({});

  const onDocumentLoad = ({ numPages }) => {
    setNumPages(numPages);
  };

  // Navigate to target page from citation
  useEffect(() => {
    if (targetPage && targetPage >= 1 && targetPage <= numPages) {
      scrollToPage(targetPage);
    }
  }, [targetPage, numPages]);

  const scrollToPage = useCallback((page) => {
    setCurrentPage(page);
    const el = pageRefs.current[page];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handlePageChange = (page) => {
    const p = Math.max(1, Math.min(page, numPages));
    scrollToPage(p);
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
  const handleFit = () => setScale(1.2);

  // Track scroll position to update current page
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerTop = container.scrollTop + 100;
    for (let i = numPages; i >= 1; i--) {
      const el = pageRefs.current[i];
      if (el && el.offsetTop <= containerTop) {
        setCurrentPage(i);
        break;
      }
    }
  }, [numPages]);

  return (
    <>
      <PDFToolbar
        currentPage={currentPage}
        numPages={numPages}
        scale={scale}
        showThumbnails={showThumbnails}
        onPageChange={handlePageChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitPage={handleFit}
        onToggleThumbnails={() => setShowThumbnails(!showThumbnails)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnails sidebar */}
        {showThumbnails && (
          <div className="page-thumbnails">
            <Document file={url} loading="">
              {Array.from({ length: numPages }, (_, i) => (
                <div
                  key={i + 1}
                  className={`page-thumb ${currentPage === i + 1 ? 'active' : ''}`}
                  onClick={() => scrollToPage(i + 1)}
                >
                  <Page
                    pageNumber={i + 1}
                    width={96}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                  <span className="page-thumb-number">{i + 1}</span>
                </div>
              ))}
            </Document>
          </div>
        )}

        {/* Main PDF canvas */}
        <div
          ref={containerRef}
          className="pdf-canvas-container"
          onScroll={handleScroll}
        >
          <Document
            file={url}
            onLoadSuccess={onDocumentLoad}
            loading={
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-10 h-10 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" style={{ borderStyle: 'solid' }} />
                  <p className="text-sm text-slate-500">Loading PDF...</p>
                </div>
              </div>
            }
            error={
              <div className="text-center py-20">
                <p className="text-sm text-rose-600">Failed to load PDF. Please try again.</p>
              </div>
            }
          >
            <div className="flex flex-col items-center gap-4">
              {Array.from({ length: numPages }, (_, i) => (
                <div
                  key={i + 1}
                  ref={(el) => (pageRefs.current[i + 1] = el)}
                  className="pdf-page"
                >
                  <Page
                    pageNumber={i + 1}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </div>
              ))}
            </div>
          </Document>
        </div>
      </div>
    </>
  );
};

export default PDFViewer;
