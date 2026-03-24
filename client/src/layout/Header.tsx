import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'الشجرة' },
    { path: '/stats', label: 'الإحصائيات' },
    { path: '/search', label: 'البحث' },
    { path: '/relationship', label: 'صلة القرابة' },
  ];

  const isActive = (path: string) => location.pathname === path;

  if (!isAuthenticated) return null;

  return (
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

          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map(item => (
              <Link key={item.path} to={item.path}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                  isActive(item.path) ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text hover:bg-surface'
                }`}>{item.label}</Link>
            ))}
            {isAdmin && (
              <Link to="/admin/dashboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                  location.pathname.startsWith('/admin') ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text hover:bg-surface'
                }`}>لوحة التحكم</Link>
            )}
            <div className="w-px h-5 bg-gray-200 mx-2" />
            <span className="text-xs text-text-secondary">{user?.full_name || user?.username}</span>
            <button onClick={logout} className="px-3 py-1.5 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 transition-colors cursor-pointer bg-transparent border-none">خروج</button>
          </nav>

          <button onClick={() => setMenuOpen(!menuOpen)} className="sm:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-surface cursor-pointer bg-transparent border-none">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav className="sm:hidden pb-3 flex flex-col gap-1">
            {navItems.map(item => (
              <Link key={item.path} to={item.path} onClick={() => setMenuOpen(false)}
                className={`px-3 py-2 rounded-lg text-sm font-medium no-underline ${isActive(item.path) ? 'bg-primary/10 text-primary' : 'text-text-secondary'}`}>{item.label}</Link>
            ))}
            {isAdmin && <Link to="/admin/dashboard" onClick={() => setMenuOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-text-secondary no-underline">لوحة التحكم</Link>}
            <button onClick={() => { logout(); setMenuOpen(false); }} className="px-3 py-2 rounded-lg text-sm font-medium text-danger text-start cursor-pointer bg-transparent border-none">خروج</button>
          </nav>
        )}
      </div>
    </header>
  );
}
