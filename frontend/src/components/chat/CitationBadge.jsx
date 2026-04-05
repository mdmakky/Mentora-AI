import { FileText } from 'lucide-react';

const CitationBadge = ({ docName, pageNumber, onClick }) => {
  const displayName = docName
    ? docName.length > 20
      ? docName.slice(0, 18) + '...'
      : docName
    : 'Source';

  return (
    <button
      className="citation-badge"
      onClick={onClick}
      title={`${docName || 'Source'} — Page ${pageNumber || '?'}`}
    >
      <FileText size={10} />
      <span>{displayName}</span>
      {pageNumber && (
        <>
          <span className="text-emerald-400">·</span>
          <span>p.{pageNumber}</span>
        </>
      )}
    </button>
  );
};

export default CitationBadge;
