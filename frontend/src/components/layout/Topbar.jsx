import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, ChevronRight, X, FileText, BookOpen } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

const Topbar = ({ onMenuClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchInputRef = useRef(null);
  const searchTimerRef = useRef(null);
  const notifRef = useRef(null);

  // Build breadcrumbs from path
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, i) => {
    let label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    if (segment.length === 36 && segment.split('-').length === 5) {
      if (pathSegments[i - 1] === 'course') label = 'Course Details';
      else if (pathSegments[i - 1] === 'document') label = 'Document View';
      else label = 'Details';
    }
    return {
      label,
      path: '/' + pathSegments.slice(0, i + 1).join('/'),
      isLast: i === pathSegments.length - 1,
    };
  });

  // Focus search input when modal opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
      setSearchResults(null);
    }
  }, [searchOpen]);

  // Keyboard shortcut: Ctrl/Cmd + K to open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    clearTimeout(searchTimerRef.current);

    if (!value.trim()) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.get(`/dashboard/search?q=${encodeURIComponent(value.trim())}`);
        setSearchResults(data);
      } catch {
        setSearchResults({ courses: [], documents: [] });
      }
      setSearching(false);
    }, 300);
  };

  const handleResultClick = (type, id) => {
    setSearchOpen(false);
    if (type === 'course') navigate(`/course/${id}`);
    else navigate(`/document/${id}`);
  };

  return (
    <>
      <div className="app-topbar">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 mr-3 transition"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
          {breadcrumbs.map((crumb) => (
            <span key={crumb.path} className="flex items-center gap-1 min-w-0">
              {crumb.isLast ? (
                <span className="font-semibold text-slate-900 truncate">
                  {crumb.label}
                </span>
              ) : (
                <>
                  <button
                    onClick={() => navigate(crumb.path)}
                    className="text-slate-500 hover:text-slate-800 transition truncate"
                  >
                    {crumb.label}
                  </button>
                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                </>
              )}
            </span>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            title="Search (Ctrl+K)"
          >
            <Search size={18} />
          </button>
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition relative"
              title="Notifications"
            >
              <Bell size={18} />
            </button>
            {/* Notification dropdown */}
            {notifOpen && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 animate-scale-in overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-800">Notifications</p>
                </div>
                <div className="py-8 text-center">
                  <Bell size={24} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No new notifications</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 animate-fade-in"
          style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-scale-in overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 border-b border-slate-100">
              <Search size={18} className="text-slate-400 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search courses and documents..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="flex-1 py-4 text-sm outline-none bg-transparent"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {searching && (
                <div className="py-6 text-center">
                  <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" style={{ borderStyle: 'solid' }} />
                </div>
              )}

              {!searching && searchResults && (
                <>
                  {searchResults.courses?.length > 0 && (
                    <div className="p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Courses</p>
                      {searchResults.courses.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleResultClick('course', c.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition text-left"
                        >
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color || '#2563EB' }} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{c.course_name}</p>
                            <p className="text-xs text-slate-400">{c.course_code}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.documents?.length > 0 && (
                    <div className="p-2 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Documents</p>
                      {searchResults.documents.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => handleResultClick('document', d.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition text-left"
                        >
                          <FileText size={14} className="text-blue-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{d.file_name}</p>
                            <p className="text-xs text-slate-400 capitalize">{d.file_type} · {d.processing_status}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.courses?.length === 0 && searchResults.documents?.length === 0 && (
                    <div className="py-8 text-center">
                      <Search size={24} className="text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No results for "{searchQuery}"</p>
                    </div>
                  )}
                </>
              )}

              {!searching && !searchResults && (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-400">Type to search courses and documents</p>
                  <p className="text-[10px] text-slate-300 mt-1">Press Esc to close</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Topbar;

