import { useEffect, useState, useRef } from 'react';
import { getStats } from '../services/api';
import type { Stats } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SaudiHeatMap from '../components/SaudiHeatMap';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------
function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [target, duration]);

  return value;
}

// ---------------------------------------------------------------------------
// StatCard (hero row)
// ---------------------------------------------------------------------------
function StatCard({
  label,
  target,
  icon,
  color = 'primary',
  delay = 0,
}: {
  label: string;
  target: number;
  icon: string;
  color?: string;
  delay?: number;
}) {
  const count = useCountUp(target);
  const palette: Record<string, { bg: string; border: string; icon: string }> = {
    primary: {
      bg: 'bg-primary/5',
      border: 'border-primary/30',
      icon: 'bg-primary/10 text-primary',
    },
    success: {
      bg: 'bg-success/5',
      border: 'border-success/30',
      icon: 'bg-success/10 text-success',
    },
    warning: {
      bg: 'bg-warning/5',
      border: 'border-warning/30',
      icon: 'bg-warning/10 text-warning',
    },
    danger: {
      bg: 'bg-danger/5',
      border: 'border-danger/30',
      icon: 'bg-danger/10 text-danger',
    },
    gray: {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      icon: 'bg-gray-100 text-gray-600',
    },
  };
  const p = palette[color] || palette.primary;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.08 }}
      whileHover={{ y: -4, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      className={`${p.bg} rounded-2xl border ${p.border} p-5 cursor-default select-none`}
    >
      <div
        className={`w-10 h-10 rounded-xl ${p.icon} flex items-center justify-center mb-3 text-lg`}
      >
        {icon}
      </div>
      <p className="text-3xl font-black text-text tabular-nums">
        {count.toLocaleString('ar-SA')}
      </p>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// TabButton
// ---------------------------------------------------------------------------
function TabButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer border-none ${
        active
          ? 'bg-primary text-white shadow-md shadow-primary/25'
          : 'bg-white text-text-secondary hover:bg-surface-dark hover:text-text border border-gray-100'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// DonutChart (pure SVG)
// ---------------------------------------------------------------------------
function DonutChart({
  segments,
  size = 180,
  strokeWidth = 28,
  title,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  title: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <h4 className="text-base font-bold text-text">{title}</h4>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {segments.map((seg, i) => {
            const pct = seg.value / total;
            const dashLen = pct * circumference;
            const dashOff = accumulated * circumference;
            accumulated += pct;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={hovered === i ? strokeWidth + 6 : strokeWidth}
                strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                strokeDashoffset={-dashOff}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  opacity: hovered !== null && hovered !== i ? 0.4 : 1,
                }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hovered !== null ? (
            <>
              <span className="text-2xl font-black text-text">
                {segments[hovered].value}
              </span>
              <span className="text-xs text-text-secondary">
                {segments[hovered].label}
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-black text-text">{total}</span>
              <span className="text-xs text-text-secondary">الإجمالي</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 text-xs cursor-pointer transition-opacity ${
              hovered !== null && hovered !== i ? 'opacity-40' : ''
            }`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: seg.color }}
            />
            <span className="text-text-secondary">
              {seg.label} ({seg.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InteractiveBar - horizontal bar with hover tooltip
// ---------------------------------------------------------------------------
function InteractiveBar({
  items,
  colorFn,
  maxOverride,
}: {
  items: { label: string; value: number }[];
  colorFn?: (i: number) => string;
  maxOverride?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = maxOverride ?? Math.max(...items.map((d) => d.value), 1);
  const total = items.reduce((s, d) => s + d.value, 0);
  const defaultColors = [
    '#007AFF',
    '#34C759',
    '#FF9500',
    '#FF3B30',
    '#AF52DE',
    '#5AC8FA',
    '#FF2D55',
    '#FFCC00',
    '#64D2FF',
    '#30D158',
  ];
  const getColor =
    colorFn ?? ((i: number) => defaultColors[i % defaultColors.length]);

  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const pct = max > 0 ? (item.value / max) * 100 : 0;
        const pctOfTotal =
          total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <div
            key={i}
            className={`group flex items-center gap-3 transition-all duration-200 cursor-default ${
              hovered !== null && hovered !== i ? 'opacity-40' : ''
            }`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="text-sm text-text-secondary w-28 text-start shrink-0 truncate"
              title={item.label}
            >
              {item.label || '\u2014'}
            </span>
            <div className="flex-1 bg-surface rounded-full h-7 overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.max(pct, item.value > 0 ? 8 : 0)}%`,
                }}
                transition={{ duration: 0.8, delay: i * 0.04, ease: 'easeOut' }}
                className="h-full rounded-full flex items-center justify-end pe-2.5"
                style={{ backgroundColor: getColor(i) }}
              >
                <span className="text-xs font-bold text-white drop-shadow-sm">
                  {item.value}
                </span>
              </motion.div>
              {hovered === i && (
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-text text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap z-10">
                  {item.label}: {item.value} ({pctOfTotal}%)
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SegmentedBar - colorful segmented horizontal bar
// ---------------------------------------------------------------------------
function SegmentedBar({
  segments,
  title,
}: {
  segments: { label: string; value: number; color: string }[];
  title: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  return (
    <div>
      <h4 className="text-base font-bold text-text mb-3">{title}</h4>
      <div className="flex rounded-full overflow-hidden h-9 mb-3 relative">
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          return (
            <motion.div
              key={i}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, delay: i * 0.05 }}
              className="h-full flex items-center justify-center relative cursor-pointer transition-opacity"
              style={{
                backgroundColor: seg.color,
                opacity: hovered !== null && hovered !== i ? 0.4 : 1,
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {pct > 8 && (
                <span className="text-xs font-bold text-white">
                  {Math.round(pct)}%
                </span>
              )}
              {hovered === i && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-text text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap z-20">
                  {seg.label}: {seg.value}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 text-xs cursor-pointer transition-opacity ${
              hovered !== null && hovered !== i ? 'opacity-40' : ''
            }`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: seg.color }}
            />
            <span className="text-text-secondary">
              {seg.label} ({seg.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimelineChart - vertical bars for each decade
// ---------------------------------------------------------------------------
function TimelineChart({
  data,
}: {
  data: { decade: string; count: number }[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.count), 1);
  const barH = 160;
  return (
    <div>
      <h4 className="text-base font-bold text-text mb-4">
        الجدول الزمني للمواليد حسب العقد
      </h4>
      <div
        className="flex items-end gap-2 overflow-x-auto pb-2"
        style={{ minHeight: barH + 40 }}
      >
        {data.map((d, i) => {
          const h = Math.max(
            (d.count / max) * barH,
            d.count > 0 ? 12 : 4
          );
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1 shrink-0 cursor-default"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                className={`text-xs font-bold text-primary transition-opacity ${
                  hovered !== null && hovered !== i ? 'opacity-30' : ''
                }`}
              >
                {d.count}
              </span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: h }}
                transition={{ duration: 0.6, delay: i * 0.06 }}
                className={`w-9 rounded-t-lg transition-all duration-200 ${
                  hovered === i
                    ? 'bg-primary'
                    : 'bg-gradient-to-t from-primary to-primary-light'
                }`}
              />
              <span className="text-[10px] text-text-secondary -rotate-45 origin-top-right mt-1 whitespace-nowrap">
                {d.decade}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AchievementCard
// ---------------------------------------------------------------------------
function AchievementCard({
  title,
  name,
  detail,
  icon,
  gradient,
  delay = 0,
}: {
  title: string;
  name: string;
  detail: string;
  icon: string;
  gradient: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      whileHover={{ scale: 1.03, y: -4 }}
      className={`relative rounded-2xl p-6 text-white overflow-hidden cursor-default ${gradient}`}
    >
      <div className="absolute -top-4 -left-4 text-6xl opacity-20 select-none">
        {icon}
      </div>
      <div className="relative z-10">
        <p className="text-sm font-medium opacity-80 mb-1">{title}</p>
        <p className="text-xl font-black mb-1 leading-tight">{name}</p>
        <p className="text-sm opacity-80">{detail}</p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------
function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section title
// ---------------------------------------------------------------------------
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-bold text-text mb-4">{children}</h3>;
}

// ---------------------------------------------------------------------------
// Helper: marriage status labels
// ---------------------------------------------------------------------------
const marriageLabels: Record<string, string> = {
  married: 'متزوج',
  divorced: 'مطلق',
  widowed: 'أرمل',
  deceased: 'متوفاة',
  single: 'أعزب',
};

// ---------------------------------------------------------------------------
// Chart colors palette
// ---------------------------------------------------------------------------
const COLORS = [
  '#007AFF',
  '#34C759',
  '#FF9500',
  '#FF3B30',
  '#AF52DE',
  '#5AC8FA',
  '#FF2D55',
  '#FFCC00',
  '#64D2FF',
  '#30D158',
  '#BF5AF2',
  '#FF6482',
  '#00C7BE',
  '#A2845E',
  '#5E5CE6',
];

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
type Tab = 'overview' | 'geographic' | 'work' | 'ages' | 'records';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: '📊' },
  { id: 'geographic', label: 'التوزيع الجغرافي', icon: '🗺' },
  { id: 'work', label: 'العمل والمهن', icon: '💼' },
  { id: 'ages', label: 'الأعمار والأجيال', icon: '📅' },
  { id: 'records', label: 'أرقام قياسية', icon: '🏆' },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size="lg" />;
  if (!stats)
    return (
      <p className="text-center py-20 text-text-secondary">
        خطأ في تحميل الإحصائيات
      </p>
    );

  // Derived data --------------------------------------------------------
  const genData = stats.generationDistribution.map((g) => ({
    label: `الجيل ${g.generation}`,
    value: g.count,
  }));
  const branchData = [...stats.branches]
    .sort((a, b) => b.total_descendants - a.total_descendants)
    .map((b) => ({
      label: b.name.split(' ').slice(0, 2).join(' '),
      value: b.total_descendants,
    }));
  const marriageData = (stats.marriageStats || []).map((m) => ({
    label: marriageLabels[m.status] || m.status,
    value: m.count,
  }));
  const cityData = (stats.cityDistribution || []).map((c) => ({
    label: c.city,
    value: c.count,
  }));
  const workTypeData = (stats.workTypeDistribution || []).map((w) => ({
    label: w.work_type,
    value: w.count,
  }));
  const workPlaceData = (stats.workPlaceDistribution || []).map((w) => ({
    label: w.work_place,
    value: w.count,
  }));
  const occupationData = (stats.occupationDistribution || []).map((o) => ({
    label: o.occupation,
    value: o.count,
  }));
  const nationalityData = stats.nationalityDistribution || [];
  const ageData = (stats.ageDistribution || []).map((a) => ({
    label: a.range,
    value: a.count,
  }));
  const timelineData = (stats.timelineData || []).map((t) => ({
    decade: String(t.decade),
    count: t.count,
  }));

  const topCity =
    cityData.length > 0
      ? cityData.reduce((a, b) => (b.value > a.value ? b : a))
      : null;
  const topOcc =
    occupationData.length > 0
      ? occupationData.reduce((a, b) => (b.value > a.value ? b : a))
      : null;

  // Tab content renderers -----------------------------------------------
  const renderOverview = () => (
    <motion.div
      key="overview"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Gender donut */}
      <Card>
        <DonutChart
          title="توزيع الجنس"
          segments={[
            { label: 'ذكور', value: stats.maleCount, color: '#007AFF' },
            { label: 'إناث', value: stats.femaleCount, color: '#FF3B30' },
          ]}
        />
      </Card>

      {/* Living vs deceased */}
      <Card>
        <SectionTitle>الأحياء والمتوفين</SectionTitle>
        <div className="flex flex-col gap-4">
          <div className="flex rounded-full overflow-hidden h-10">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${(stats.livingCount / Math.max(stats.totalMembers, 1)) * 100}%`,
              }}
              transition={{ duration: 0.8 }}
              className="bg-success flex items-center justify-center"
            >
              <span className="text-xs font-bold text-white">
                {stats.livingCount}
              </span>
            </motion.div>
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${(stats.deceasedCount / Math.max(stats.totalMembers, 1)) * 100}%`,
              }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="bg-gray-400 flex items-center justify-center"
            >
              <span className="text-xs font-bold text-white">
                {stats.deceasedCount}
              </span>
            </motion.div>
          </div>
          <div className="flex justify-between text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-success" />
              <span>أحياء ({stats.livingCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-400" />
              <span>متوفين ({stats.deceasedCount})</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-success/5 rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-success">
                {Math.round(
                  (stats.livingCount / Math.max(stats.totalMembers, 1)) * 100
                )}
                %
              </p>
              <p className="text-xs text-text-secondary mt-1">نسبة الأحياء</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-gray-500">
                {Math.round(
                  (stats.deceasedCount / Math.max(stats.totalMembers, 1)) * 100
                )}
                %
              </p>
              <p className="text-xs text-text-secondary mt-1">نسبة المتوفين</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Marriage stats */}
      {marriageData.length > 0 && (
        <Card>
          <SectionTitle>حالات الزواج</SectionTitle>
          <InteractiveBar items={marriageData} />
        </Card>
      )}

      {/* Branches */}
      {branchData.length > 0 && (
        <Card>
          <SectionTitle>أحجام الفروع</SectionTitle>
          <InteractiveBar items={branchData.slice(0, 15)} />
        </Card>
      )}
    </motion.div>
  );

  const renderGeographic = () => (
    <motion.div
      key="geographic"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Saudi HeatMap */}
      {stats.cityDistribution && stats.cityDistribution.length > 0 && (
        <Card className="lg:col-span-2">
          <SaudiHeatMap data={stats.cityDistribution} />
        </Card>
      )}

      {/* City distribution bar chart */}
      {cityData.length > 0 && (
        <Card>
          <SectionTitle>التوزيع حسب المدينة</SectionTitle>
          <InteractiveBar
            items={[...cityData].sort((a, b) => b.value - a.value).slice(0, 15)}
            colorFn={(i) => COLORS[i % COLORS.length]}
          />
        </Card>
      )}

      {/* Nationality chips */}
      {nationalityData.length > 0 && (
        <Card>
          <SectionTitle>التوزيع حسب الجنسية</SectionTitle>
          <div className="flex flex-wrap gap-3">
            {[...nationalityData]
              .sort((a, b) => b.count - a.count)
              .map((n, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.08 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-default"
                  style={{
                    backgroundColor: `${COLORS[i % COLORS.length]}15`,
                    borderLeft: `3px solid ${COLORS[i % COLORS.length]}`,
                  }}
                >
                  <span className="text-sm font-bold text-text">
                    {n.nationality}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  >
                    {n.count}
                  </span>
                </motion.div>
              ))}
          </div>
        </Card>
      )}
    </motion.div>
  );

  const renderWork = () => {
    const workTypeSegments = workTypeData.map((w, i) => ({
      label: w.label,
      value: w.value,
      color: COLORS[i % COLORS.length],
    }));

    return (
      <motion.div
        key="work"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Work type segmented bar */}
        {workTypeSegments.length > 0 && (
          <Card className="lg:col-span-2">
            <SegmentedBar segments={workTypeSegments} title="توزيع أنواع العمل" />
          </Card>
        )}

        {/* Top workplaces */}
        {workPlaceData.length > 0 && (
          <Card>
            <SectionTitle>أبرز جهات العمل</SectionTitle>
            <InteractiveBar
              items={[...workPlaceData]
                .sort((a, b) => b.value - a.value)
                .slice(0, 12)}
              colorFn={() => '#FF9500'}
            />
          </Card>
        )}

        {/* Top occupations */}
        {occupationData.length > 0 && (
          <Card>
            <SectionTitle>أبرز المهن</SectionTitle>
            <InteractiveBar
              items={[...occupationData]
                .sort((a, b) => b.value - a.value)
                .slice(0, 12)}
              colorFn={() => '#AF52DE'}
            />
          </Card>
        )}
      </motion.div>
    );
  };

  const renderAges = () => (
    <motion.div
      key="ages"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Age distribution histogram */}
      {ageData.length > 0 && (
        <Card>
          <SectionTitle>التوزيع العمري</SectionTitle>
          <InteractiveBar
            items={ageData}
            colorFn={(i) => {
              const ratio = i / Math.max(ageData.length - 1, 1);
              const r = Math.round(0 + ratio * 255);
              const g = Math.round(122 - ratio * 63);
              const b = Math.round(255 - ratio * 207);
              return `rgb(${r},${g},${b})`;
            }}
          />
        </Card>
      )}

      {/* Generation distribution */}
      {genData.length > 0 && (
        <Card>
          <SectionTitle>توزيع الأجيال</SectionTitle>
          <InteractiveBar
            items={genData}
            colorFn={(i) => COLORS[i % COLORS.length]}
          />
        </Card>
      )}

      {/* Timeline chart */}
      {timelineData.length > 0 && (
        <Card className="lg:col-span-2">
          <TimelineChart data={timelineData} />
        </Card>
      )}

      {/* Average children stat card */}
      <Card className="flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center text-3xl mb-3">
          👶
        </div>
        <p className="text-4xl font-black text-text">
          {(stats.averageChildrenPerMember ?? 0).toFixed(1)}
        </p>
        <p className="text-sm text-text-secondary mt-1">
          متوسط الأبناء لكل عضو
        </p>
      </Card>
    </motion.div>
  );

  const renderRecords = () => {
    const cards: {
      title: string;
      name: string;
      detail: string;
      icon: string;
      gradient: string;
    }[] = [];

    if (stats.youngestMember) {
      cards.push({
        title: 'أصغر عضو',
        name: stats.youngestMember.name,
        detail: `تاريخ الميلاد: ${stats.youngestMember.birth_date}`,
        icon: '🌟',
        gradient: 'bg-gradient-to-br from-green-400 to-emerald-600',
      });
    }
    if (stats.oldestMember) {
      cards.push({
        title: 'أكبر عضو',
        name: stats.oldestMember.name,
        detail: `تاريخ الميلاد: ${stats.oldestMember.birth_date}`,
        icon: '👑',
        gradient: 'bg-gradient-to-br from-amber-400 to-orange-600',
      });
    }
    if (stats.mostChildren) {
      cards.push({
        title: 'أكثر أبناء',
        name: stats.mostChildren.name,
        detail: `${stats.mostChildren.count} أبناء`,
        icon: '👨‍👩‍👧‍👦',
        gradient: 'bg-gradient-to-br from-blue-400 to-indigo-600',
      });
    }
    if (stats.mostDescendants) {
      cards.push({
        title: 'أكثر أحفاد',
        name: stats.mostDescendants.name,
        detail: `${stats.mostDescendants.count} فرد`,
        icon: '🌳',
        gradient: 'bg-gradient-to-br from-purple-400 to-violet-600',
      });
    }
    if (topCity) {
      cards.push({
        title: 'المدينة الأكثر تمثيلاً',
        name: topCity.label,
        detail: `${topCity.value} عضو`,
        icon: '🏙',
        gradient: 'bg-gradient-to-br from-cyan-400 to-teal-600',
      });
    }
    if (topOcc) {
      cards.push({
        title: 'أكثر مهنة انتشاراً',
        name: topOcc.label,
        detail: `${topOcc.value} عضو`,
        icon: '💼',
        gradient: 'bg-gradient-to-br from-pink-400 to-rose-600',
      });
    }

    // Extra stats cards
    cards.push({
      title: 'متوسط الأبناء',
      name: String((stats.averageChildrenPerMember ?? 0).toFixed(1)),
      detail: 'لكل ذكر في العائلة',
      icon: '📈',
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
    });
    cards.push({
      title: 'عدد الأجيال',
      name: String(stats.maxGeneration),
      detail: 'من الجد إلى أحدث جيل',
      icon: '🏛',
      gradient: 'bg-gradient-to-br from-sky-500 to-blue-600',
    });
    cards.push({
      title: 'إجمالي الأفراد',
      name: String(stats.totalMembers),
      detail: 'في شجرة العائلة',
      icon: '👥',
      gradient: 'bg-gradient-to-br from-fuchsia-500 to-pink-600',
    });

    return (
      <motion.div
        key="records"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {cards.map((c, i) => (
          <AchievementCard key={i} {...c} delay={i} />
        ))}
      </motion.div>
    );
  };

  const tabContent: Record<Tab, () => React.ReactNode> = {
    overview: renderOverview,
    geographic: renderGeographic,
    work: renderWork,
    ages: renderAges,
    records: renderRecords,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-black text-text mb-2">
          إحصائيات العائلة
        </h1>
        <p className="text-text-secondary">
          نظرة شاملة وتفاعلية على عائلة آل بامفلح
        </p>
      </motion.div>

      {/* Hero stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="إجمالي الأعضاء"
          target={stats.totalMembers}
          icon="👥"
          color="primary"
          delay={0}
        />
        <StatCard
          label="عدد الأجيال"
          target={stats.maxGeneration}
          icon="🏛️"
          color="success"
          delay={1}
        />
        <StatCard
          label="الذكور"
          target={stats.maleCount}
          icon="♂"
          color="primary"
          delay={2}
        />
        <StatCard
          label="الإناث"
          target={stats.femaleCount}
          icon="♀"
          color="danger"
          delay={3}
        />
        <StatCard
          label="الأحياء"
          target={stats.livingCount}
          icon="💚"
          color="success"
          delay={4}
        />
        <StatCard
          label="المتوفين"
          target={stats.deceasedCount}
          icon="🕊️"
          color="gray"
          delay={5}
        />
      </div>

      {/* Tab navigation */}
      <div className="mobile-tabs flex gap-2 overflow-x-auto pb-2 mb-6 sm:mb-8">
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            label={t.label}
            icon={t.icon}
            active={tab === t.id}
            onClick={() => setTab(t.id)}
          />
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">{tabContent[tab]()}</AnimatePresence>
    </div>
  );
}
