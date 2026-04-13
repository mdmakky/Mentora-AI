import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2,
  Columns, Download,
} from 'lucide-react';

const PDFToolbar = ({
  currentPage,
  numPages,
  scale,
  isMobile,
  showThumbnails,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onFitPage,
  onToggleThumbnails,
}) => {
  const handleInput = (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) onPageChange(val);
  };

  return (
    <div className="pdf-toolbar">
      {/* Left: page nav */}
      <div className="pdf-toolbar-group">
        <button className={`pdf-toolbar-btn ${isMobile ? 'hidden' : ''}`} onClick={onToggleThumbnails} title="Toggle thumbnails">
          <Columns size={16} />
        </button>
        <div className={`w-px h-5 bg-slate-200 mx-1 ${isMobile ? 'hidden' : ''}`} />
        <button
          className="pdf-toolbar-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="number"
            min={1}
            max={numPages}
            value={currentPage}
            onChange={handleInput}
            className="pdf-page-input"
          />
          <span className="text-slate-400">/</span>
          <span>{numPages}</span>
        </div>
        <button
          className="pdf-toolbar-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= numPages}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Center: zoom */}
      <div className="pdf-toolbar-group">
        <button className="pdf-toolbar-btn" onClick={onZoomOut} title="Zoom out">
          <ZoomOut size={16} />
        </button>
        <span className="text-xs font-medium text-slate-500 w-12 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button className="pdf-toolbar-btn" onClick={onZoomIn} title="Zoom in">
          <ZoomIn size={16} />
        </button>
        <button className={`pdf-toolbar-btn ${isMobile ? 'hidden' : ''}`} onClick={onFitPage} title="Fit page">
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Right: actions */}
      <div className="pdf-toolbar-group">
        {/* placeholder for future buttons */}
      </div>
    </div>
  );
};

export default PDFToolbar;
