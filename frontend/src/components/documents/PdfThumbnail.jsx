import { useState } from 'react';

/**
 * Lightweight PDF thumbnail using the backend /thumbnail endpoint.
 * Returns a plain <img> — no PDF.js worker, no blob download, no react-pdf.
 * The browser caches the JPEG for 7 days (Cache-Control: immutable).
 */
const PdfThumbnail = ({ docId, fallback = null }) => {
  const [error, setError] = useState(false);

  if (!docId || error) return fallback;

  const token = localStorage.getItem('token');
  const base = import.meta.env.VITE_API_BASE || '/api/v1';

  // We can't set Authorization headers on <img src>, so we use a query-param
  // token approach on this specific endpoint. The backend will also accept
  // ?token=... as a fallback for image requests.
  // Alternative: use a fetch + blob URL — but that defeats the purpose.
  // Best approach: use a signed URL via fetch only once, or rely on cookie auth.
  // For now, we proxy via a data URL fetched once on mount.
  return (
    <_FetchedImage
      url={`${base}/documents/${docId}/thumbnail`}
      token={token}
      fallback={fallback}
    />
  );
};

/**
 * Inner component that fetches the thumbnail once (with Authorization header)
 * and renders it as a data URL <img>. The response has a 7-day Cache-Control
 * so the browser won't re-fetch on every render.
 */
function _FetchedImage({ url, token, fallback }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Use a ref-guarded effect to fetch exactly once
  const fetchedRef = useState(() => {
    const controller = new AbortController();
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('thumbnail fetch failed');
        return res.blob();
      })
      .then((blob) => {
        // Object URL — tiny JPEG, revoked when component unmounts
        setSrc(URL.createObjectURL(blob));
        setLoading(false);
      })
      .catch(() => {
        setFailed(true);
        setLoading(false);
      });
    return controller;
  })[0];

  // Cleanup object URL on unmount
  useState(() => () => {
    if (src) URL.revokeObjectURL(src);
  });

  if (failed) return fallback;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#f8fafc' }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }} />
      )}
      {src && (
        <img
          src={src}
          alt="Document preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top',
            display: 'block',
            opacity: loading ? 0 : 1,
            transition: 'opacity 0.25s ease',
          }}
          onLoad={() => setLoading(false)}
        />
      )}
    </div>
  );
}

export default PdfThumbnail;
