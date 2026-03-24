import { useState, useEffect, useMemo } from 'react';
import { findRelationship, getMembers } from '../services/api';
import type { Member, RelationshipResult } from '../types';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/common/LoadingSpinner';

function PersonSelector({
  label,
  members,
  selectedId,
  onSelect,
  otherId,
}: {
  label: string;
  members: Member[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  otherId: number | null;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => m.id !== otherId && m.name.toLowerCase().includes(q))
      .slice(0, 15);
  }, [query, members, otherId]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedId) ?? null,
    [members, selectedId],
  );

  const handleSelect = (m: Member) => {
    onSelect(m.id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
  };

  return (
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-text-secondary mb-2">{label}</p>

      {selectedMember ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-4 flex items-center gap-3"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary font-black text-lg">
              {selectedMember.name.charAt(0)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-text truncate">{selectedMember.name}</p>
            <p className="text-xs text-text-secondary">
              الجيل {selectedMember.generation}
            </p>
          </div>
          <button
            onClick={handleClear}
            className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-text-secondary hover:text-danger hover:border-danger transition-colors shrink-0"
          >
            ✕
          </button>
        </motion.div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => query.trim() && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="ابحث بالاسم..."
            className="w-full bg-white border-2 border-gray-100 rounded-2xl px-4 py-3.5 text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-primary/40 transition-colors"
          />
          <AnimatePresence>
            {open && filtered.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute z-30 top-full mt-2 w-full bg-white rounded-2xl shadow-lg border border-gray-100 max-h-60 overflow-y-auto"
              >
                {filtered.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(m)}
                      className="w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                    >
                      <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                        {m.name.charAt(0)}
                      </span>
                      <span className="text-text text-sm truncate">{m.name}</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
          {query.trim() && filtered.length === 0 && open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute z-30 top-full mt-2 w-full bg-white rounded-2xl shadow-lg border border-gray-100 px-4 py-6 text-center text-sm text-text-secondary"
            >
              لا توجد نتائج
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

function PathDiagram({ result }: { result: RelationshipResult }) {
  const { person1, person2, lca, path } = result;

  // Split path into: person1 -> ... -> LCA -> ... -> person2
  const lcaIndex = lca ? path.findIndex((p) => p.id === lca.id) : -1;

  // Right side: person1 up to LCA (ascending)
  const rightSide = lcaIndex >= 0 ? path.slice(0, lcaIndex) : [];
  // Left side: LCA down to person2 (descending)
  const leftSide = lcaIndex >= 0 ? path.slice(lcaIndex + 1) : [];

  // If no LCA, show the whole path as a line
  const hasLca = lca !== null && lcaIndex >= 0;

  if (!hasLca) {
    // Simple linear path
    return (
      <div className="flex items-center justify-center gap-2 flex-wrap py-4">
        {path.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.12, type: 'spring', stiffness: 260, damping: 20 }}
            className="flex items-center gap-2"
          >
            <Link
              to={`/person/${node.id}`}
              className={`px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
                node.id === person1.id || node.id === person2.id
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text hover:bg-primary/10'
              }`}
            >
              {node.name}
            </Link>
            {i < path.length - 1 && (
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.12 + 0.06 }}
                className="text-text-secondary"
              >
                ←
              </motion.span>
            )}
          </motion.div>
        ))}
      </div>
    );
  }

  // Visual diagram: Person1 (right) ---up---> LCA ---down---> Person2 (left)
  return (
    <div className="relative py-8">
      {/* SVG connecting lines */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
      >
        {/* Right side line (person1 up to LCA) */}
        <motion.line
          x1="75%"
          y1="75%"
          x2="50%"
          y2="20%"
          stroke="#007AFF"
          strokeWidth="2"
          strokeDasharray="6 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.4 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
        {/* Left side line (LCA down to person2) */}
        <motion.line
          x1="50%"
          y1="20%"
          x2="25%"
          y2="75%"
          stroke="#007AFF"
          strokeWidth="2"
          strokeDasharray="6 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.4 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        />
      </svg>

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* LCA at top */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Link
            to={`/person/${lca.id}`}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-16 h-16 rounded-full bg-warning/20 border-3 border-warning flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <span className="text-warning font-black text-xl">
                {lca.name.charAt(0)}
              </span>
            </div>
            <span className="text-sm font-bold text-warning">{lca.name}</span>
            <span className="text-[10px] text-text-secondary bg-warning/10 px-2 py-0.5 rounded-full">
              الجد المشترك
            </span>
          </Link>
        </motion.div>

        {/* Ascending / Descending paths */}
        <div className="flex items-start justify-center gap-12 w-full max-w-lg">
          {/* Right side - Person1's ancestors going up */}
          <div className="flex flex-col items-center gap-2 flex-1">
            {rightSide
              .slice()
              .reverse()
              .map((node, i) => (
                <motion.div
                  key={node.id}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  <Link
                    to={`/person/${node.id}`}
                    className="text-xs text-text-secondary hover:text-primary transition-colors bg-surface px-2.5 py-1 rounded-full"
                  >
                    {node.name}
                  </Link>
                </motion.div>
              ))}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 20 }}
            >
              <Link
                to={`/person/${person1.id}`}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-14 h-14 rounded-full bg-primary/15 border-3 border-primary flex items-center justify-center shadow group-hover:scale-110 transition-transform">
                  <span className="text-primary font-black text-lg">
                    {person1.name.charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-bold text-primary">{person1.name}</span>
              </Link>
            </motion.div>
          </div>

          {/* Left side - Person2's ancestors going up */}
          <div className="flex flex-col items-center gap-2 flex-1">
            {leftSide.map((node, i) => (
              <motion.div
                key={node.id}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1.0 + i * 0.1 }}
              >
                <Link
                  to={`/person/${node.id}`}
                  className="text-xs text-text-secondary hover:text-primary transition-colors bg-surface px-2.5 py-1 rounded-full"
                >
                  {node.name}
                </Link>
              </motion.div>
            ))}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 20 }}
            >
              <Link
                to={`/person/${person2.id}`}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-14 h-14 rounded-full bg-success/15 border-3 border-success flex items-center justify-center shadow group-hover:scale-110 transition-transform">
                  <span className="text-success font-black text-lg">
                    {person2.name.charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-bold text-success">{person2.name}</span>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RelationshipPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [person1Id, setPerson1Id] = useState<number | null>(null);
  const [person2Id, setPerson2Id] = useState<number | null>(null);
  const [result, setResult] = useState<RelationshipResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    getMembers()
      .then(setMembers)
      .catch(() => setError('تعذّر تحميل قائمة الأعضاء'))
      .finally(() => setLoadingMembers(false));
  }, []);

  const handleFind = async () => {
    if (!person1Id || !person2Id) return;
    setSearching(true);
    setError(null);
    setResult(null);
    setHasSearched(true);
    try {
      const data = await findRelationship(person1Id, person2Id);
      setResult(data);
    } catch {
      setError('حدث خطأ أثناء البحث عن صلة القرابة');
    } finally {
      setSearching(false);
    }
  };

  const canSearch = person1Id !== null && person2Id !== null && !searching;

  if (loadingMembers) return <LoadingSpinner size="lg" />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl font-black text-text mb-2">صلة القرابة</h1>
        <p className="text-text-secondary">
          اكتشف الروابط العائلية بين أفراد العائلة
        </p>
      </motion.div>

      {/* Selection area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6"
      >
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <PersonSelector
            label="الشخص الأول"
            members={members}
            selectedId={person1Id}
            onSelect={setPerson1Id}
            otherId={person2Id}
          />
          {/* Connector icon */}
          <div className="hidden sm:flex items-center justify-center pt-7">
            <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
              <span className="text-text-secondary text-lg">↔</span>
            </div>
          </div>
          <PersonSelector
            label="الشخص الثاني"
            members={members}
            selectedId={person2Id}
            onSelect={setPerson2Id}
            otherId={person1Id}
          />
        </div>

        {/* Find button */}
        <motion.button
          whileHover={canSearch ? { scale: 1.02 } : {}}
          whileTap={canSearch ? { scale: 0.98 } : {}}
          onClick={handleFind}
          disabled={!canSearch}
          className={`w-full py-4 rounded-2xl text-lg font-bold transition-all ${
            canSearch
              ? 'bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary-dark'
              : 'bg-surface text-text-secondary cursor-not-allowed'
          }`}
        >
          {searching ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              جارٍ البحث...
            </span>
          ) : (
            'اكتشف صلة القرابة'
          )}
        </motion.button>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-danger/10 border border-danger/20 rounded-2xl p-4 text-center text-danger font-bold mb-6"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {searching && (
        <div className="py-12">
          <LoadingSpinner size="lg" />
          <p className="text-center text-text-secondary mt-4">
            جارٍ البحث عن صلة القرابة...
          </p>
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && !searching && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            {result.relationship ? (
              <>
                {/* Relationship label */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.2,
                    type: 'spring',
                    stiffness: 200,
                    damping: 12,
                  }}
                  className="text-center mb-6"
                >
                  <div className="inline-block bg-primary/5 border-2 border-primary/20 rounded-3xl px-8 py-6">
                    <p className="text-sm text-text-secondary mb-1">صلة القرابة</p>
                    <p className="text-4xl font-black text-primary">
                      {result.relationship}
                    </p>
                    <p className="text-sm text-text-secondary mt-2">
                      <span className="font-bold text-text">{result.person1.name}</span>
                      {' '}و{' '}
                      <span className="font-bold text-text">{result.person2.name}</span>
                    </p>
                  </div>
                </motion.div>

                {/* Path diagram */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6"
                >
                  <h3 className="text-lg font-bold text-text mb-2 text-center">
                    مسار القرابة
                  </h3>
                  <PathDiagram result={result} />
                </motion.div>

                {/* Info card */}
                {result.lca && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
                  >
                    <h3 className="text-lg font-bold text-text mb-4 text-center">
                      تفاصيل العلاقة
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-warning/5 rounded-xl p-4 text-center border border-warning/10">
                        <p className="text-xs text-text-secondary mb-1">
                          الجد المشترك
                        </p>
                        <Link
                          to={`/person/${result.lca.id}`}
                          className="font-bold text-warning hover:underline"
                        >
                          {result.lca.name}
                        </Link>
                      </div>
                      <div className="bg-primary/5 rounded-xl p-4 text-center border border-primary/10">
                        <p className="text-xs text-text-secondary mb-1">
                          المسافة من {result.person1.name}
                        </p>
                        <p className="font-black text-2xl text-primary">
                          {(() => {
                            const lcaIdx = result.path.findIndex(
                              (p) => p.id === result.lca!.id,
                            );
                            return lcaIdx >= 0 ? lcaIdx : '—';
                          })()}
                        </p>
                        <p className="text-[10px] text-text-secondary">خطوة</p>
                      </div>
                      <div className="bg-success/5 rounded-xl p-4 text-center border border-success/10">
                        <p className="text-xs text-text-secondary mb-1">
                          المسافة من {result.person2.name}
                        </p>
                        <p className="font-black text-2xl text-success">
                          {(() => {
                            const lcaIdx = result.path.findIndex(
                              (p) => p.id === result.lca!.id,
                            );
                            return lcaIdx >= 0
                              ? result.path.length - 1 - lcaIdx
                              : '—';
                          })()}
                        </p>
                        <p className="text-[10px] text-text-secondary">خطوة</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            ) : (
              /* No relationship found */
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-surface mx-auto mb-4 flex items-center justify-center">
                  <span className="text-3xl text-text-secondary">؟</span>
                </div>
                <p className="text-xl font-bold text-text mb-2">
                  لا توجد صلة قرابة مباشرة
                </p>
                <p className="text-text-secondary text-sm">
                  لم يتم العثور على رابط مباشر بين{' '}
                  <span className="font-bold text-text">{result.person1.name}</span> و{' '}
                  <span className="font-bold text-text">{result.person2.name}</span>
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state before search */}
      {!hasSearched && !searching && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center py-16"
        >
          <div className="w-24 h-24 rounded-full bg-primary/5 mx-auto mb-4 flex items-center justify-center">
            <span className="text-4xl text-primary/40">🔗</span>
          </div>
          <p className="text-text-secondary text-sm">
            اختر شخصين من العائلة لاكتشاف صلة القرابة بينهما
          </p>
        </motion.div>
      )}
    </div>
  );
}
