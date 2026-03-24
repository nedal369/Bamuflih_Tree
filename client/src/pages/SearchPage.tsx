import { useEffect, useState, useCallback, useRef } from 'react';
import { searchMembers } from '../services/api';
import type { Member, SearchResult } from '../types';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface Filters {
  q: string;
  gender: string;
  generation: string;
  city: string;
  work_type: string;
  work_place: string;
  occupation: string;
  nationality: string;
  alive: string;
}

const emptyFilters: Filters = {
  q: '',
  gender: '',
  generation: '',
  city: '',
  work_type: '',
  work_place: '',
  occupation: '',
  nationality: '',
  alive: '',
};

const workTypeLabels: Record<string, string> = {
  'حكومي': 'حكومي',
  'خاص': 'خاص',
  'عسكري': 'عسكري',
  'حر': 'حر',
};

const filterLabels: Record<keyof Filters, string> = {
  q: 'البحث',
  gender: 'الجنس',
  generation: 'الجيل',
  city: 'المدينة',
  work_type: 'نوع العمل',
  work_place: 'جهة العمل',
  occupation: 'المهنة',
  nationality: 'الجنسية',
  alive: 'الحالة',
};

function FilterSection({ title, open, onToggle, children }: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-1 text-sm font-bold text-text hover:text-primary transition-colors"
      >
        <span>{title}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-text-secondary"
        >
          ▼
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-3 px-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FacetChips({ facets, selected, onSelect }: {
  facets: Record<string, number>;
  selected: string;
  onSelect: (val: string) => void;
}) {
  const entries = Object.entries(facets).filter(([k]) => k);
  if (entries.length === 0) return <p className="text-xs text-text-secondary">لا توجد بيانات</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, count]) => (
        <button
          key={key}
          onClick={() => onSelect(selected === key ? '' : key)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            selected === key
              ? 'bg-primary text-white shadow-sm'
              : 'bg-surface text-text-secondary hover:bg-primary/10 hover:text-primary'
          }`}
        >
          {key} <span className="opacity-70">({count})</span>
        </button>
      ))}
    </div>
  );
}

export default function SearchPage() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    gender: true,
    generation: true,
    city: true,
    work_type: true,
    occupation: false,
    nationality: false,
    alive: true,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (f: Filters) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      for (const [key, val] of Object.entries(f)) {
        if (val) params[key] = val;
      }
      const data = await searchMembers(params);
      setResults(data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    doSearch(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search on filter change (skip initial)
  const updateFilter = useCallback(
    (key: keyof Filters, value: string) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(next), key === 'q' ? 300 : 50);
        return next;
      });
    },
    [doSearch]
  );

  const clearFilter = (key: keyof Filters) => updateFilter(key, '');

  const clearAllFilters = () => {
    const cleared = { ...emptyFilters };
    setFilters(cleared);
    doSearch(cleared);
  };

  const activeFilters = Object.entries(filters).filter(
    ([key, val]) => val && key !== 'q'
  ) as [keyof Filters, string][];

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const formatFilterValue = (key: keyof Filters, val: string): string => {
    if (key === 'gender') return val === 'male' ? 'ذكر' : 'أنثى';
    if (key === 'alive') return val === 'true' ? 'على قيد الحياة' : 'متوفى';
    if (key === 'generation') return `الجيل ${val}`;
    return val;
  };

  // Sidebar content
  const sidebarContent = (
    <div className="space-y-1">
      {/* Gender */}
      <FilterSection title="الجنس" open={openSections.gender} onToggle={() => toggleSection('gender')}>
        <div className="flex gap-2">
          {[
            { value: 'male', label: 'ذكر' },
            { value: 'female', label: 'أنثى' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => updateFilter('gender', filters.gender === value ? '' : value)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                filters.gender === value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface text-text-secondary hover:bg-primary/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Generation */}
      <FilterSection title="الجيل" open={openSections.generation} onToggle={() => toggleSection('generation')}>
        <select
          value={filters.generation}
          onChange={(e) => updateFilter('generation', e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">جميع الأجيال</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
            <option key={g} value={String(g)}>
              الجيل {g}
            </option>
          ))}
        </select>
      </FilterSection>

      {/* City */}
      <FilterSection title="المدينة" open={openSections.city} onToggle={() => toggleSection('city')}>
        {results?.facets?.city ? (
          <FacetChips facets={results.facets.city} selected={filters.city} onSelect={(v) => updateFilter('city', v)} />
        ) : (
          <p className="text-xs text-text-secondary">ابحث لعرض المدن</p>
        )}
      </FilterSection>

      {/* Work Type */}
      <FilterSection title="نوع العمل" open={openSections.work_type} onToggle={() => toggleSection('work_type')}>
        <div className="flex flex-wrap gap-2">
          {Object.entries(workTypeLabels).map(([value, label]) => (
            <button
              key={value}
              onClick={() => updateFilter('work_type', filters.work_type === value ? '' : value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filters.work_type === value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface text-text-secondary hover:bg-primary/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Occupation */}
      <FilterSection title="المهنة" open={openSections.occupation} onToggle={() => toggleSection('occupation')}>
        {results?.facets?.occupation ? (
          <FacetChips
            facets={results.facets.occupation}
            selected={filters.occupation}
            onSelect={(v) => updateFilter('occupation', v)}
          />
        ) : (
          <p className="text-xs text-text-secondary">ابحث لعرض المهن</p>
        )}
      </FilterSection>

      {/* Nationality */}
      <FilterSection title="الجنسية" open={openSections.nationality} onToggle={() => toggleSection('nationality')}>
        {results?.facets?.nationality ? (
          <FacetChips
            facets={results.facets.nationality}
            selected={filters.nationality}
            onSelect={(v) => updateFilter('nationality', v)}
          />
        ) : (
          <p className="text-xs text-text-secondary">ابحث لعرض الجنسيات</p>
        )}
      </FilterSection>

      {/* Alive/Deceased */}
      <FilterSection title="الحالة" open={openSections.alive} onToggle={() => toggleSection('alive')}>
        <div className="flex gap-2">
          {[
            { value: 'true', label: 'على قيد الحياة' },
            { value: 'false', label: 'متوفى' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => updateFilter('alive', filters.alive === value ? '' : value)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                filters.alive === value
                  ? value === 'true'
                    ? 'bg-success text-white shadow-sm'
                    : 'bg-gray-500 text-white shadow-sm'
                  : 'bg-surface text-text-secondary hover:bg-primary/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Clear all */}
      {activeFilters.length > 0 && (
        <button
          onClick={clearAllFilters}
          className="w-full mt-3 py-2 rounded-xl text-sm font-medium text-danger bg-danger/10 hover:bg-danger/20 transition-all"
        >
          مسح جميع الفلاتر
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-text mb-2">البحث المتقدم</h1>
        <p className="text-text-secondary">ابحث في شجرة عائلة آل بامفلح</p>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary text-xl pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            value={filters.q}
            onChange={(e) => updateFilter('q', e.target.value)}
            placeholder="ابحث بالاسم..."
            className="w-full pr-12 pl-4 py-4 rounded-2xl border border-gray-200 bg-white shadow-sm text-text text-lg placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            autoFocus
          />
          {filters.q && (
            <button
              onClick={() => updateFilter('q', '')}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-danger transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Mobile filter toggle */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full py-3 rounded-2xl bg-white shadow-sm border border-gray-100 text-sm font-bold text-text flex items-center justify-center gap-2"
        >
          <span>⚙</span>
          <span>الفلاتر</span>
          {activeFilters.length > 0 && (
            <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilters.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile filters drawer */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden overflow-hidden mb-4"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              {sidebarContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main layout */}
      <div className="flex gap-6">
        {/* Sidebar - desktop */}
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-4">
            <h2 className="text-base font-black text-text mb-3">تصفية النتائج</h2>
            {sidebarContent}
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {/* Active filters */}
          {activeFilters.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 mb-4"
            >
              {activeFilters.map(([key, val]) => (
                <motion.span
                  key={key}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                >
                  <span className="text-primary/60">{filterLabels[key]}:</span>
                  <span>{formatFilterValue(key, val)}</span>
                  <button
                    onClick={() => clearFilter(key)}
                    className="hover:text-danger transition-colors mr-1"
                  >
                    ✕
                  </button>
                </motion.span>
              ))}
            </motion.div>
          )}

          {/* Result count */}
          {results && !initialLoad && (
            <p className="text-sm text-text-secondary mb-4">
              {loading ? (
                'جاري البحث...'
              ) : (
                <>
                  تم العثور على{' '}
                  <span className="font-bold text-text">{results.total}</span> نتيجة
                </>
              )}
            </p>
          )}

          {/* Loading */}
          {loading && initialLoad && <LoadingSpinner size="lg" />}

          {/* Results grid */}
          {!initialLoad && (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {results?.members.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* No results */}
          {!loading && results && results.total === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-lg font-bold text-text mb-1">لا توجد نتائج</p>
              <p className="text-sm text-text-secondary">
                جرب تعديل معايير البحث أو{' '}
                <button onClick={clearAllFilters} className="text-primary hover:underline">
                  مسح الفلاتر
                </button>
              </p>
            </motion.div>
          )}

          {/* Loading overlay for non-initial */}
          {loading && !initialLoad && (
            <div className="flex justify-center py-4">
              <LoadingSpinner size="sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberCard({ member }: { member: Member }) {
  const isAlive = !member.death_date;
  const isMale = member.gender === 'male';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        to={`/person/${member.id}`}
        className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-primary/20 transition-all group"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                isMale
                  ? 'bg-primary/10 text-primary'
                  : 'bg-danger/10 text-danger'
              }`}
            >
              {isMale ? '♂' : '♀'}
            </span>
            <h3 className="font-bold text-text group-hover:text-primary transition-colors truncate">
              {member.name}
            </h3>
          </div>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
              isAlive
                ? 'bg-success/10 text-success'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {isAlive ? 'حي' : 'متوفى'}
          </span>
        </div>

        <div className="space-y-1.5 text-xs text-text-secondary">
          {member.city && (
            <div className="flex items-center gap-1.5">
              <span className="opacity-60">📍</span>
              <span>{member.city}</span>
            </div>
          )}
          {member.occupation && (
            <div className="flex items-center gap-1.5">
              <span className="opacity-60">💼</span>
              <span>{member.occupation}</span>
            </div>
          )}
          {member.work_place && (
            <div className="flex items-center gap-1.5">
              <span className="opacity-60">🏢</span>
              <span>{member.work_place}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="opacity-60">🌳</span>
            <span>الجيل {member.generation}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
