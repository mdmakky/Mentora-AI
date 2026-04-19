import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ShieldCheck,
  Users,
  FileWarning,
  Activity,
  ClipboardList
} from 'lucide-react';
import { useState, useEffect } from 'react';
import useAuthStore from '../../stores/authStore';
import { apiClient } from '../../lib/apiClient';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/courses', label: 'My Courses', icon: BookOpen },
  { to: '/chat', label: 'Study Coach', icon: MessageSquare },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const Sidebar = ({ collapsed, mobileOpen, onToggle, onMobileClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [pendingReviews, setPendingReviews] = useState(0);

  useEffect(() => {
    if (!user?.is_admin) return;
    const fetchCount = async () => {
      try {
        const data = await apiClient.get('/admin/stats');
        setPendingReviews(data?.pending_reviews || 0);
      } catch {/* silent */}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [user?.is_admin]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Toggle button */}
      <button className="sidebar-toggle" onClick={onToggle}>
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <GraduationCap size={20} color="white" />
        </div>
        {!collapsed && <span className="sidebar-brand-text">Mentora</span>}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {!collapsed && <div className="sidebar-section-title">Main</div>}

        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onMobileClose}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={20} className="sidebar-link-icon" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {user?.is_admin && (
          <>
            {!collapsed && <div className="sidebar-section-title mt-6">Admin Panel</div>}
            {[
              { to: '/admin/dashboard', label: 'Admin Dashboard', icon: ShieldCheck },
              { to: '/admin/users', label: 'User Roles', icon: Users },
              { to: '/admin/documents?tab=review_pending', label: 'Review Queue', icon: ClipboardList, badge: pendingReviews, activeCheck: () => location.pathname === '/admin/documents' && new URLSearchParams(location.search).get('tab') === 'review_pending' },
              { to: '/admin/documents', label: 'Quarantine', icon: FileWarning, activeCheck: () => location.pathname === '/admin/documents' && new URLSearchParams(location.search).get('tab') !== 'review_pending' },
              { to: '/admin/logs', label: 'Activity Logs', icon: Activity },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onMobileClose}
                className={() =>
                  `sidebar-link ${item.activeCheck ? (item.activeCheck() ? 'active' : '') : (location.pathname === item.to ? 'active' : '')}`
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={20} className="sidebar-link-icon text-indigo-400" />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {!collapsed && item.badge > 0 && (
                  <span className="ml-auto min-w-4.5 h-4.5 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white px-1">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
                {collapsed && item.badge > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {!collapsed && user && (
          <NavLink
            to="/profile"
            onClick={onMobileClose}
            className="flex items-center gap-3 mb-4 px-1 rounded-xl p-2 hover:bg-white/10 transition cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                : user.full_name?.charAt(0)?.toUpperCase() || 'U'
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.full_name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </NavLink>
        )}
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-left hover:bg-rose-500/20 hover:text-rose-300"
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={20} className="sidebar-link-icon" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
