import { FileText, Quote } from 'lucide-react';

const CitationBadge = ({ docName, pageNumber, excerpt, onClick }) => {
  const displayName = docName
    ? docName.length > 20
      ? docName.slice(0, 18) + '...'
      : docName
    : 'Source';

  const tooltip = excerpt
    ? `${docName || 'Source'} — Page ${pageNumber || '?'}\n\n${excerpt}`
    : `${docName || 'Source'} — Page ${pageNumber || '?'}`;

  return (
    <button
      className="citation-badge"
      onClick={onClick}
      title={tooltip}
    >
      <FileText size={10} />
      <span>{displayName}</span>
      {pageNumber && (
        <>
          <span className="text-emerald-400">·</span>
          <span>p.{pageNumber}</span>
        </>
      )}
      {excerpt && <Quote size={10} className="citation-badge-icon" />}
    </button>
  );
};

export default CitationBadge;
