import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, ChevronRight } from 'lucide-react';

const Topbar = ({ onMenuClick }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Build breadcrumbs from path
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, i) => ({
    label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
    path: '/' + pathSegments.slice(0, i + 1).join('/'),
    isLast: i === pathSegments.length - 1,
  }));

  return (
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
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
          <Search size={18} />
        </button>
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition relative">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
        </button>
      </div>
    </div>
  );
};

export default Topbar;
