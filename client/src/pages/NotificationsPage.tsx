import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getNotifications } from '../services/api';
import type { Notification } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'birthday_today' | 'birthday_upcoming' | 'new_member'>('all');

  useEffect(() => {
    getNotifications()
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size="lg" />;

  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);

  const todayCount = notifications.filter(n => n.type === 'birthday_today').length;
  const upcomingCount = notifications.filter(n => n.type === 'birthday_upcoming').length;
  const newCount = notifications.filter(n => n.type === 'new_member').length;

  const typeConfig = {
    birthday_today: { icon: '🎂', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800', label: 'عيد ميلاد اليوم' },
    birthday_upcoming: { icon: '🎁', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800', label: 'أعياد ميلاد قادمة' },
    new_member: { icon: '👶', bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800', label: 'عضو جديد' },
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-text m-0">الإشعارات</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <div className="text-3xl mb-1">🎂</div>
          <div className="text-2xl font-bold text-amber-800">{todayCount}</div>
          <div className="text-sm text-amber-600">عيد ميلاد اليوم</div>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <div className="text-3xl mb-1">🎁</div>
          <div className="text-2xl font-bold text-blue-800">{upcomingCount}</div>
          <div className="text-sm text-blue-600">أعياد ميلاد قادمة (30 يوم)</div>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
          <div className="text-3xl mb-1">👶</div>
          <div className="text-2xl font-bold text-green-800">{newCount}</div>
          <div className="text-sm text-green-600">أعضاء جدد (30 يوم)</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'all' as const, label: 'الكل', count: notifications.length },
          { key: 'birthday_today' as const, label: 'اليوم', count: todayCount },
          { key: 'birthday_upcoming' as const, label: 'قادمة', count: upcomingCount },
          { key: 'new_member' as const, label: 'أعضاء جدد', count: newCount },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium cursor-pointer border-none transition-colors ${
              filter === tab.key
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-gray-200'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-text-secondary text-lg">لا توجد إشعارات حالياً</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n, i) => {
            const config = typeConfig[n.type];
            return (
              <Link
                key={`${n.member_id}-${n.type}-${i}`}
                to={`/person/${n.member_id}`}
                className="no-underline"
              >
                <div className={`${config.bg} border ${config.border} rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow`}>
                  {/* Photo or icon */}
                  <div className="flex-shrink-0">
                    {n.photo ? (
                      <img src={n.photo} alt={n.name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                        n.gender === 'female' ? 'bg-pink-100' : 'bg-blue-100'
                      }`}>
                        {n.gender === 'female' ? '👩' : '👨'}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{config.icon}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-lg ${config.badge}`}>{config.label}</span>
                    </div>
                    <p className="text-sm font-medium text-text mt-1 m-0">{n.message}</p>
                  </div>

                  {/* Arrow */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
