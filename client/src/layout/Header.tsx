import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const generalTreeIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;

export default function Header() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isOnGeneralTree = location.pathname.startsWith('/general-tree');

  const navItems = [
    { path: '/', label: 'الشجرة', mobileLabel: 'الشجرة', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { path: '/stats', label: 'الإحصائيات', mobileLabel: 'إحصائيات', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { path: '/search', label: 'البحث', mobileLabel: 'البحث', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
    { path: '/relationship', label: 'القرابة', mobileLabel: 'القرابة', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
    { path: '/fund', label: 'الصندوق', mobileLabel: 'الصندوق', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg> },
    { path: '/notifications', label: 'الإشعارات', mobileLabel: 'إشعارات', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
    { path: '/general-tree', label: 'الشجرة العامة', mobileLabel: 'العامة', icon: generalTreeIcon },
  ];

  const isActive = (path: string) => {
    if (path === '/general-tree') return location.pathname.startsWith('/general-tree');
    return location.pathname === path;
  };

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Show minimal header for general tree when not authenticated
  if (!isAuthenticated && !isOnGeneralTree) return null;

  if (!isAuthenticated && isOnGeneralTree) {
    return (
      <>
        <header className="glass sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <Link to="/general-tree" className="flex items-center gap-2 no-underline">
                <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
                  {generalTreeIcon}
                </div>
                <span className="text-base font-bold text-text">آل بامفلح - الشجرة العامة</span>
              </Link>
              <Link to="/login" className="px-3 py-1.5 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors no-underline">تسجيل الدخول</Link>
            </div>
          </div>
        </header>
      </>
    );
  }

  return (
    <>
      {/* Top header bar */}
      <header className="glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2 no-underline">
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <span className="text-base font-bold text-text">آل بامفلح</span>
            </Link>

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <Link key={item.path} to={item.path}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                    isActive(item.path) ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text hover:bg-surface'
                  }`}>{item.label}</Link>
              ))}
              {isAdmin && (
                <>
                  <Link to="/admin/dashboard"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                      location.pathname === '/admin/dashboard' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text hover:bg-surface'
                    }`}>لوحة التحكم</Link>
                  <Link to="/admin/event-calculator"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                      location.pathname === '/admin/event-calculator' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text hover:bg-surface'
                    }`}>حاسبة المناسبات</Link>
                </>
              )}
              <div className="w-px h-5 bg-gray-200 mx-2" />
              <span className="text-xs text-text-secondary">{user?.full_name || user?.username}</span>
              <button onClick={logout} className="px-3 py-1.5 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 transition-colors cursor-pointer bg-transparent border-none">خروج</button>
            </nav>

            {/* Mobile: user info + hamburger */}
            <div className="md:hidden flex items-center gap-2">
              <span className="text-xs text-text-secondary hidden min-[400px]:inline">{user?.full_name || user?.username}</span>
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-surface cursor-pointer bg-transparent border-none">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {menuOpen ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                    : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile dropdown menu for extra items */}
          {menuOpen && (
            <nav className="md:hidden pb-3 flex flex-col gap-1 border-t border-gray-100 pt-2">
              {isAdmin && (
                <>
                  <Link to="/admin/dashboard" onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium no-underline ${location.pathname === '/admin/dashboard' ? 'bg-primary/10 text-primary' : 'text-text-secondary'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    لوحة التحكم
                  </Link>
                  <Link to="/admin/event-calculator" onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium no-underline ${location.pathname === '/admin/event-calculator' ? 'bg-primary/10 text-primary' : 'text-text-secondary'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="15" x2="10" y2="15"/><line x1="12" y1="15" x2="14" y2="15"/><line x1="16" y1="15" x2="18" y2="15"/></svg>
                    حاسبة المناسبات
                  </Link>
                </>
              )}
              <button onClick={() => { logout(); setMenuOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-danger text-start cursor-pointer bg-transparent border-none">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                خروج
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Mobile bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 px-0.5 rounded-xl no-underline transition-colors ${
                isActive(item.path)
                  ? 'text-primary'
                  : 'text-text-secondary'
              }`}
            >
              <span className={`${isActive(item.path) ? 'text-primary' : 'text-gray-400'}`}>{item.icon}</span>
              <span className="text-[9px] font-medium leading-tight truncate max-w-full">{item.mobileLabel}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
