import { useEffect, useState } from 'react';
import { getStats } from '../services/api';
import type { Stats } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';

function StatCard({ label, value, color = 'primary' }: { label: string; value: number | string; color?: string }) {
  const colors: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in-up">
      <div className={`w-10 h-10 rounded-xl ${colors[color]} flex items-center justify-center mb-3`}>
        <span className="text-lg font-bold">#</span>
      </div>
      <p className="text-3xl font-black text-text animate-count">{value}</p>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
    </div>
  );
}

function BarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in-up">
      <h3 className="text-lg font-bold text-text mb-4">{label}</h3>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm text-text-secondary w-20 text-start shrink-0">{item.label}</span>
            <div className="flex-1 bg-surface rounded-full h-6 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out flex items-center justify-end pe-2"
                style={{ width: `${(item.value / max) * 100}%`, minWidth: item.value > 0 ? '2rem' : 0 }}
              >
                <span className="text-xs font-bold text-white">{item.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size="lg" />;
  if (!stats) return <p className="text-center py-20 text-text-secondary">خطأ في تحميل الإحصائيات</p>;

  const genData = stats.generationDistribution.map(g => ({
    label: `الجيل ${g.generation}`,
    value: g.count,
  }));

  const branchData = stats.branches.map(b => ({
    label: b.name.split(' ').slice(0, 2).join(' '),
    value: b.total_descendants,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-text mb-2">إحصائيات العائلة</h1>
        <p className="text-text-secondary">نظرة شاملة على شجرة عائلة آل بامفلح</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="إجمالي الأعضاء" value={stats.totalMembers} color="primary" />
        <StatCard label="عدد الأجيال" value={stats.maxGeneration} color="success" />
        <StatCard label="الذكور" value={stats.maleCount} color="primary" />
        <StatCard label="الإناث" value={stats.femaleCount} color="danger" />
        <StatCard label="الأحياء" value={stats.livingCount} color="success" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart data={genData} label="توزيع الأجيال" />
        {branchData.length > 0 && <BarChart data={branchData} label="أحجام الفروع" />}

        {/* Gender Split */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in-up">
          <h3 className="text-lg font-bold text-text mb-4">توزيع الجنس</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex rounded-full overflow-hidden h-8">
                <div
                  className="bg-primary flex items-center justify-center transition-all duration-1000"
                  style={{ width: `${(stats.maleCount / stats.totalMembers) * 100}%` }}
                >
                  <span className="text-xs font-bold text-white">{Math.round((stats.maleCount / stats.totalMembers) * 100)}%</span>
                </div>
                <div
                  className="bg-danger flex items-center justify-center transition-all duration-1000"
                  style={{ width: `${(stats.femaleCount / stats.totalMembers) * 100}%` }}
                >
                  <span className="text-xs font-bold text-white">{Math.round((stats.femaleCount / stats.totalMembers) * 100)}%</span>
                </div>
              </div>
              <div className="flex justify-between mt-2 text-sm text-text-secondary">
                <span>ذكور ({stats.maleCount})</span>
                <span>إناث ({stats.femaleCount})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Living vs Deceased */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in-up">
          <h3 className="text-lg font-bold text-text mb-4">الأحياء والمتوفين</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex rounded-full overflow-hidden h-8">
                <div
                  className="bg-success flex items-center justify-center transition-all duration-1000"
                  style={{ width: `${(stats.livingCount / stats.totalMembers) * 100}%` }}
                >
                  <span className="text-xs font-bold text-white">{stats.livingCount}</span>
                </div>
                <div
                  className="bg-gray-400 flex items-center justify-center transition-all duration-1000"
                  style={{ width: `${(stats.deceasedCount / stats.totalMembers) * 100}%` }}
                >
                  <span className="text-xs font-bold text-white">{stats.deceasedCount}</span>
                </div>
              </div>
              <div className="flex justify-between mt-2 text-sm text-text-secondary">
                <span>أحياء ({stats.livingCount})</span>
                <span>متوفين ({stats.deceasedCount})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
