import { useEffect, useState } from 'react';
import { getStats } from '../services/api';
import type { Stats } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SaudiHeatMap from '../components/SaudiHeatMap';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Animated Counter ─── */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const dur = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setDisplay(Math.floor(p * value));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <>{display.toLocaleString('ar-SA')}</>;
}

/* ─── Stat Card ─── */
function StatCard({ label, value, icon, color = 'primary', subtitle }: { label: string; value: number | string; icon: string; color?: string; subtitle?: string }) {
  const colors: Record<string, string> = {
    primary: 'border-primary/30 bg-primary/5',
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/30 bg-warning/5',
    danger: 'border-danger/30 bg-danger/5',
    purple: 'border-purple-400/30 bg-purple-50',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      className={`bg-white rounded-2xl shadow-sm border-2 ${colors[color]} p-5 hover:shadow-md transition-shadow`}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-3xl font-black text-text">{typeof value === 'number' ? <AnimatedNumber value={value} /> : value}</p>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
      {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
    </motion.div>
  );
}

/* ─── Interactive Bar ─── */
function InteractiveBar({ data, label, color = 'bg-primary', maxItems }: { data: { label: string; value: number }[]; label: string; color?: string; maxItems?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const items = maxItems ? data.slice(0, maxItems) : data;
  const max = Math.max(...items.map(d => d.value), 1);
  const total = items.reduce((s, d) => s + d.value, 0);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-bold text-text mb-1">{label}</h3>
      <p className="text-xs text-text-secondary mb-4">الإجمالي: {total}</p>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="group" onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-sm text-text-secondary">{item.label || '—'}</span>
              <motion.span animate={{ scale: hovered === i ? 1.2 : 1 }} className="text-xs font-bold text-text">{item.value}</motion.span>
            </div>
            <div className="bg-surface rounded-full h-5 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(item.value / max) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.05 }}
                className={`h-full ${color} rounded-full flex items-center justify-end pe-2 transition-all ${hovered === i ? 'brightness-110' : ''}`}
                style={{ minWidth: item.value > 0 ? '1.5rem' : 0 }}>
                <span className="text-[10px] font-bold text-white">{Math.round((item.value / total) * 100)}%</span>
              </motion.div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Donut Chart (SVG) ─── */
function DonutChart({ segments, size = 180, label }: { segments: { label: string; value: number; color: string }[]; size?: number; label: string }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  const r = 70, cx = 90, cy = 90, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-bold text-text mb-4">{label}</h3>
      <div className="flex items-center justify-center gap-6 flex-wrap">
        <svg width={size} height={size} viewBox="0 0 180 180">
          {segments.map((seg, i) => {
            const pct = total > 0 ? seg.value / total : 0;
            const dashLen = pct * c;
            const el = (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="20"
                strokeDasharray={`${dashLen} ${c - dashLen}`} strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`} className="transition-all duration-700" />
            );
            offset += dashLen;
            return el;
          })}
          <text x={cx} y={cy - 5} textAnchor="middle" className="fill-text text-2xl font-black">{total}</text>
          <text x={cx} y={cy + 15} textAnchor="middle" className="fill-text-secondary text-xs">إجمالي</text>
        </svg>
        <div className="space-y-2">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-sm text-text">{seg.label}</span>
              <span className="text-sm font-bold text-text">{seg.value}</span>
              <span className="text-xs text-text-secondary">({total > 0 ? Math.round((seg.value / total) * 100) : 0}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Achievement Card ─── */
function AchievementCard({ title, value, subtitle, gradient }: { title: string; value: string; subtitle?: string; gradient: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
      className={`rounded-2xl p-6 text-white ${gradient} shadow-lg`}>
      <p className="text-sm opacity-80 mb-1">{title}</p>
      <p className="text-xl font-black">{value}</p>
      {subtitle && <p className="text-sm opacity-70 mt-1">{subtitle}</p>}
    </motion.div>
  );
}

/* ─── Tab Button ─── */
function TabBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border-none whitespace-nowrap ${active ? 'bg-primary text-white shadow-sm' : 'bg-transparent text-text-secondary hover:bg-surface'}`}>
      {label}
    </button>
  );
}

/* ─── Timeline ─── */
function TimelineChart({ data }: { data: { decade: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-bold text-text mb-4">الجدول الزمني للمواليد</h3>
      <div className="flex items-end gap-2 h-40">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-text">{d.count}</span>
            <motion.div initial={{ height: 0 }} animate={{ height: `${(d.count / max) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="w-full bg-gradient-to-t from-primary to-primary-light rounded-t-lg min-h-[4px]" />
            <span className="text-[10px] text-text-secondary">{d.decade}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Segmented Bar ─── */
function SegmentedBar({ segments, label }: { segments: { label: string; value: number; color: string }[]; label: string }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-bold text-text mb-4">{label}</h3>
      <div className="flex rounded-full overflow-hidden h-10 mb-4">
        {segments.map((seg, i) => (
          <motion.div key={i} initial={{ width: 0 }} animate={{ width: `${total > 0 ? (seg.value / total) * 100 : 0}%` }}
            transition={{ duration: 0.8, delay: i * 0.1 }}
            className="flex items-center justify-center" style={{ backgroundColor: seg.color }}>
            {seg.value > 0 && <span className="text-xs font-bold text-white px-1">{seg.value}</span>}
          </motion.div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-sm text-text-secondary">{seg.label} ({seg.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
type Tab = 'overview' | 'geo' | 'work' | 'ages' | 'records';

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    getStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size="lg" />;
  if (!stats) return <p className="text-center py-20 text-text-secondary">خطأ في تحميل الإحصائيات</p>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'geo', label: 'التوزيع الجغرافي' },
    { key: 'work', label: 'العمل والمهن' },
    { key: 'ages', label: 'الأعمار والأجيال' },
    { key: 'records', label: 'أرقام قياسية' },
  ];

  const genData = stats.generationDistribution.map(g => ({ label: `الجيل ${g.generation}`, value: g.count }));
  const branchData = stats.branches.map(b => ({ label: b.name.split(' ').slice(0, 2).join(' '), value: b.total_descendants }));
  const marriageLabels: Record<string, string> = { married: 'متزوج', divorced: 'مطلق', widowed: 'أرمل', deceased: 'متوفاة' };
  const marriageData = stats.marriageStats?.map(m => ({ label: marriageLabels[m.status] || m.status, value: m.count })) || [];

  const workTypeColors: Record<string, string> = { 'حكومي': '#007AFF', 'خاص': '#34C759', 'عسكري': '#FF9500', 'حر': '#AF52DE' };
  const workTypeSegments = (stats.workTypeDistribution || []).map(w => ({
    label: w.work_type, value: w.count, color: workTypeColors[w.work_type] || '#86868B'
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-text mb-2">إحصائيات العائلة</h1>
        <p className="text-text-secondary">نظرة شاملة على عائلة آل بامفلح</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="إجمالي الأعضاء" value={stats.totalMembers} icon="👥" color="primary" />
        <StatCard label="عدد الأجيال" value={stats.maxGeneration} icon="🏛️" color="success" />
        <StatCard label="الذكور" value={stats.maleCount} icon="♂" color="primary" />
        <StatCard label="الإناث" value={stats.femaleCount} icon="♀" color="danger" />
        <StatCard label="الأحياء" value={stats.livingCount} icon="💚" color="success" />
        <StatCard label="المتوفين" value={stats.deceasedCount} icon="🕊️" color="warning" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface p-1.5 rounded-2xl mb-8 overflow-x-auto">
        {tabs.map(t => <TabBtn key={t.key} active={tab === t.key} label={t.label} onClick={() => setTab(t.key)} />)}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>

          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DonutChart label="توزيع الجنس" segments={[
                  { label: 'ذكور', value: stats.maleCount, color: '#007AFF' },
                  { label: 'إناث', value: stats.femaleCount, color: '#FF3B30' },
                ]} />
                <DonutChart label="الأحياء والمتوفين" segments={[
                  { label: 'أحياء', value: stats.livingCount, color: '#34C759' },
                  { label: 'متوفين', value: stats.deceasedCount, color: '#86868B' },
                ]} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InteractiveBar data={marriageData} label="حالات الزواج" color="bg-pink-500" />
                <InteractiveBar data={branchData} label="أحجام الفروع" color="bg-indigo-500" />
              </div>
            </div>
          )}

          {tab === 'geo' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {stats.cityDistribution?.length > 0 && <SaudiHeatMap data={stats.cityDistribution} />}
                <InteractiveBar data={(stats.cityDistribution || []).map(c => ({ label: c.city, value: c.count }))} label="التوزيع حسب المدينة" color="bg-emerald-500" />
              </div>
              {(stats.nationalityDistribution || []).length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-lg font-bold text-text mb-4">التوزيع حسب الجنسية</h3>
                  <div className="flex flex-wrap gap-3">
                    {stats.nationalityDistribution.map((n, i) => (
                      <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                        className="px-4 py-2 bg-surface rounded-xl flex items-center gap-2">
                        <span className="text-sm font-medium text-text">{n.nationality}</span>
                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{n.count}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'work' && (
            <div className="space-y-6">
              {workTypeSegments.length > 0 && <SegmentedBar segments={workTypeSegments} label="أنواع العمل" />}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InteractiveBar data={(stats.workPlaceDistribution || []).map(w => ({ label: w.work_place, value: w.count }))} label="أبرز جهات العمل" color="bg-blue-500" maxItems={10} />
                <InteractiveBar data={(stats.occupationDistribution || []).map(o => ({ label: o.occupation, value: o.count }))} label="أبرز المهن" color="bg-purple-500" maxItems={10} />
              </div>
            </div>
          )}

          {tab === 'ages' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InteractiveBar data={(stats.ageDistribution || []).map(a => ({ label: a.range + ' سنة', value: a.count }))} label="التوزيع العمري" color="bg-teal-500" />
                <InteractiveBar data={genData} label="توزيع الأجيال" color="bg-violet-500" />
              </div>
              {(stats.timelineData || []).length > 0 && <TimelineChart data={stats.timelineData.map(t => ({ decade: String(t.decade), count: t.count }))} />}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="متوسط الأبناء للذكر" value={stats.averageChildrenPerMember?.toFixed(1) || '0'} icon="👨‍👧‍👦" color="primary" />
                {stats.youngestMember && <StatCard label="أصغر عضو (حي)" value={stats.youngestMember.name} icon="👶" color="success" subtitle={stats.youngestMember.birth_date} />}
                {stats.oldestMember && <StatCard label="أكبر عضو (حي)" value={stats.oldestMember.name} icon="👴" color="warning" subtitle={stats.oldestMember.birth_date} />}
              </div>
            </div>
          )}

          {tab === 'records' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.mostChildren && (
                <AchievementCard title="أكثر أبناء مباشرين" value={stats.mostChildren.name}
                  subtitle={`${stats.mostChildren.count} أبناء`} gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
              )}
              {stats.mostDescendants && (
                <AchievementCard title="أكبر ذرية" value={stats.mostDescendants.name}
                  subtitle={`${stats.mostDescendants.count} من الذرية`} gradient="bg-gradient-to-br from-purple-500 to-indigo-600" />
              )}
              {stats.youngestMember && (
                <AchievementCard title="أصغر عضو حي" value={stats.youngestMember.name}
                  subtitle={stats.youngestMember.birth_date} gradient="bg-gradient-to-br from-green-500 to-emerald-600" />
              )}
              {stats.oldestMember && (
                <AchievementCard title="أكبر عضو حي" value={stats.oldestMember.name}
                  subtitle={stats.oldestMember.birth_date} gradient="bg-gradient-to-br from-blue-500 to-cyan-600" />
              )}
              {stats.cityDistribution?.length > 0 && (
                <AchievementCard title="أكثر المدن سكاناً" value={stats.cityDistribution[0].city}
                  subtitle={`${stats.cityDistribution[0].count} عضو`} gradient="bg-gradient-to-br from-rose-500 to-pink-600" />
              )}
              {(stats.occupationDistribution || []).length > 0 && (
                <AchievementCard title="أكثر المهن شيوعاً" value={stats.occupationDistribution[0].occupation}
                  subtitle={`${stats.occupationDistribution[0].count} عضو`} gradient="bg-gradient-to-br from-teal-500 to-cyan-600" />
              )}
              <AchievementCard title="متوسط الأبناء" value={String(stats.averageChildrenPerMember?.toFixed(1) || '0')}
                subtitle="لكل ذكر" gradient="bg-gradient-to-br from-violet-500 to-purple-600" />
              <AchievementCard title="عدد الأجيال" value={String(stats.maxGeneration)}
                subtitle="من الجد إلى أحدث جيل" gradient="bg-gradient-to-br from-sky-500 to-blue-600" />
              <AchievementCard title="إجمالي الأفراد" value={String(stats.totalMembers)}
                subtitle="في شجرة العائلة" gradient="bg-gradient-to-br from-fuchsia-500 to-pink-600" />
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
