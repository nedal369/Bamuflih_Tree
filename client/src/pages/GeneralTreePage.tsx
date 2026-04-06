import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGeneralFamilies, importGeneralTreeGedcom, deleteGeneralFamily, updateGeneralFamily } from '../services/api';
import type { GeneralFamily } from '../types';
import GeneralFamilyTree from '../components/tree/GeneralFamilyTree';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

export default function GeneralTreePage() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [families, setFamilies] = useState<GeneralFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<GeneralFamily | null>(null);
  const [showEditModal, setShowEditModal] = useState<GeneralFamily | null>(null);

  // Import form state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState('');
  const [importDesc, setImportDesc] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; imported: number; marriages: number; errors: string[] } | null>(null);
  const [importError, setImportError] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadFamilies = useCallback(async () => {
    try {
      const data = await getGeneralFamilies();
      setFamilies(data);
    } catch (err) {
      console.error('Error loading general families:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!familyId) {
      loadFamilies();
    }
  }, [familyId, loadFamilies]);

  const handleImport = async () => {
    if (!importFile || !importName.trim()) return;
    setImporting(true);
    setImportError('');
    setImportResult(null);
    try {
      const result = await importGeneralTreeGedcom(importFile, importName.trim(), importDesc.trim() || undefined);
      setImportResult(result);
      loadFamilies();
      // Reset form
      setImportFile(null);
      setImportName('');
      setImportDesc('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setImportError(error.response?.data?.error || 'حدث خطأ أثناء الاستيراد');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (family: GeneralFamily) => {
    setDeleteLoading(true);
    try {
      await deleteGeneralFamily(family.id);
      setShowDeleteConfirm(null);
      loadFamilies();
    } catch (err) {
      console.error('Error deleting family:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!showEditModal || !editName.trim()) return;
    try {
      await updateGeneralFamily(showEditModal.id, { name: editName.trim(), description: editDesc.trim() || '' });
      setShowEditModal(null);
      loadFamilies();
    } catch (err) {
      console.error('Error updating family:', err);
    }
  };

  const openEdit = (family: GeneralFamily) => {
    setEditName(family.name);
    setEditDesc(family.description || '');
    setShowEditModal(family);
  };

  // Tree view for a specific family
  if (familyId) {
    const currentFamily = families.find(f => f.id === parseInt(familyId));
    return (
      <div className="flex flex-col h-[100dvh] md:h-screen">
        {/* Header bar */}
        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/general-tree')}
                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors bg-transparent border-none cursor-pointer text-sm font-medium"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                العودة
              </button>
              <div className="w-px h-5 bg-gray-200"/>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-text">{currentFamily?.name || 'الشجرة'}</h2>
                {currentFamily?.description && (
                  <p className="text-xs text-text-secondary">{currentFamily.description}</p>
                )}
              </div>
            </div>
            {isAdmin && currentFamily && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(currentFamily)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface text-text-secondary hover:bg-gray-200 transition-colors cursor-pointer border-none"
                >
                  تعديل
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(currentFamily)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors cursor-pointer border-none"
                >
                  حذف / تراجع
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <GeneralFamilyTree familyId={parseInt(familyId)} familyName={currentFamily?.name || 'الشجرة'} />
        </div>

        {/* Delete Confirmation */}
        <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="تأكيد الحذف" size="sm">
          <div className="p-4 space-y-4" dir="rtl">
            <p className="text-sm text-text-secondary">
              هل أنت متأكد من حذف أسرة <strong>"{showDeleteConfirm?.name}"</strong> وجميع بياناتها؟
            </p>
            <p className="text-xs text-danger">
              سيتم حذف جميع الأفراد ({showDeleteConfirm?.member_count} عضو) والزيجات المرتبطة بها نهائياً. هذا الإجراء لا يمكن التراجع عنه.
            </p>
            <p className="text-xs text-text-secondary">
              ملاحظة: لا يؤثر هذا الحذف على بيانات الشجرة الأصلية (ذرية صالح) أو الصندوق أو أي عمليات أخرى.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm bg-surface text-text-secondary hover:bg-gray-200 transition-colors cursor-pointer border-none"
              >
                إلغاء
              </button>
              <button
                onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg text-sm bg-danger text-white hover:bg-danger/90 transition-colors cursor-pointer border-none disabled:opacity-50"
              >
                {deleteLoading ? 'جارِ الحذف...' : 'حذف نهائياً'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal isOpen={!!showEditModal} onClose={() => setShowEditModal(null)} title="تعديل الأسرة" size="sm">
          <div className="p-4 space-y-4" dir="rtl">
            <div>
              <label className="block text-sm font-medium text-text mb-1">اسم الأسرة</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">الوصف (اختياري)</label>
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEditModal(null)} className="px-4 py-2 rounded-lg text-sm bg-surface text-text-secondary hover:bg-gray-200 transition-colors cursor-pointer border-none">إلغاء</button>
              <button onClick={handleEdit} disabled={!editName.trim()} className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer border-none disabled:opacity-50">حفظ</button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // Family list view
  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 text-center">
          <h1 className="text-2xl sm:text-4xl font-black text-text mb-2">الشجرة العامة</h1>
          <p className="text-text-secondary text-sm sm:text-base mb-4">مرجع شامل لأشجار جميع فروع آل بامفلح</p>
          <p className="text-text-secondary text-xs">عرض فقط - مستقل عن شجرة ذرية صالح والصندوق والفعاليات</p>

          {isAdmin && (
            <button
              onClick={() => { setShowImportModal(true); setImportResult(null); setImportError(''); }}
              className="mt-4 px-6 py-2.5 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer border-none shadow-lg shadow-primary/20"
            >
              <span className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                رفع ملف GEDCOM
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Family Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {families.length === 0 ? (
          <div className="text-center py-16">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D1D6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p className="text-text-secondary text-sm">لا توجد أُسر مضافة بعد</p>
            {isAdmin && <p className="text-text-secondary text-xs mt-1">استخدم زر "رفع ملف GEDCOM" لإضافة شجرة جديدة</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {families.map(family => (
              <div
                key={family.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => navigate(`/general-tree/${family.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(family); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface transition-colors cursor-pointer bg-transparent border-none text-text-secondary"
                        title="تعديل"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(family); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-danger/10 transition-colors cursor-pointer bg-transparent border-none text-danger"
                        title="حذف / تراجع"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-bold text-text mb-1 group-hover:text-primary transition-colors">{family.name}</h3>
                {family.description && <p className="text-xs text-text-secondary mb-3 line-clamp-2">{family.description}</p>}
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    </svg>
                    {family.member_count} عضو
                  </span>
                  <span>{new Date(family.created_at).toLocaleDateString('ar-SA')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import GEDCOM Modal */}
      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="رفع ملف GEDCOM" size="md">
        <div className="p-4 space-y-4" dir="rtl">
          {importResult ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-green-800 font-medium text-sm">{importResult.message}</p>
                <div className="mt-2 flex gap-4 text-xs text-green-700">
                  <span>{importResult.imported} فرد</span>
                  <span>{importResult.marriages} زيجة</span>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-yellow-800 text-xs font-medium mb-1">تحذيرات ({importResult.errors.length}):</p>
                  <div className="max-h-32 overflow-y-auto text-xs text-yellow-700 space-y-0.5">
                    {importResult.errors.map((err, i) => <p key={i}>{err}</p>)}
                  </div>
                </div>
              )}
              <button
                onClick={() => { setShowImportModal(false); setImportResult(null); }}
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer border-none font-medium"
              >
                إغلاق
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-text mb-1">اسم الأسرة *</label>
                <input
                  type="text"
                  value={importName}
                  onChange={e => setImportName(e.target.value)}
                  placeholder="مثال: فرع أحمد بامفلح"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">الوصف (اختياري)</label>
                <textarea
                  value={importDesc}
                  onChange={e => setImportDesc(e.target.value)}
                  placeholder="وصف مختصر عن هذا الفرع..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">ملف GEDCOM *</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".ged,.gedcom"
                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="gedcom-file-input"
                  />
                  <label htmlFor="gedcom-file-input" className="cursor-pointer">
                    {importFile ? (
                      <div>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <p className="text-sm font-medium text-text">{importFile.name}</p>
                        <p className="text-xs text-text-secondary mt-1">{(importFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D1D1D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <p className="text-sm text-text-secondary">اضغط لاختيار ملف .ged</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {importError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-700 text-sm">{importError}</p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg text-sm bg-surface text-text-secondary hover:bg-gray-200 transition-colors cursor-pointer border-none"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importFile || !importName.trim() || importing}
                  className="px-6 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer border-none disabled:opacity-50 font-medium"
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      جارِ الاستيراد...
                    </span>
                  ) : (
                    'استيراد'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="تأكيد الحذف" size="sm">
        <div className="p-4 space-y-4" dir="rtl">
          <p className="text-sm text-text-secondary">
            هل أنت متأكد من حذف أسرة <strong>"{showDeleteConfirm?.name}"</strong> وجميع بياناتها؟
          </p>
          <p className="text-xs text-danger">
            سيتم حذف جميع الأفراد ({showDeleteConfirm?.member_count} عضو) والزيجات المرتبطة بها نهائياً. هذا الإجراء لا يمكن التراجع عنه.
          </p>
          <p className="text-xs text-text-secondary">
            ملاحظة: لا يؤثر هذا الحذف على بيانات الشجرة الأصلية (ذرية صالح) أو الصندوق أو أي عمليات أخرى.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="px-4 py-2 rounded-lg text-sm bg-surface text-text-secondary hover:bg-gray-200 transition-colors cursor-pointer border-none"
            >
              إلغاء
            </button>
            <button
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
              disabled={deleteLoading}
              className="px-4 py-2 rounded-lg text-sm bg-danger text-white hover:bg-danger/90 transition-colors cursor-pointer border-none disabled:opacity-50"
            >
              {deleteLoading ? 'جارِ الحذف...' : 'حذف نهائياً'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!showEditModal} onClose={() => setShowEditModal(null)} title="تعديل الأسرة" size="sm">
        <div className="p-4 space-y-4" dir="rtl">
          <div>
            <label className="block text-sm font-medium text-text mb-1">اسم الأسرة</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">الوصف (اختياري)</label>
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowEditModal(null)} className="px-4 py-2 rounded-lg text-sm bg-surface text-text-secondary hover:bg-gray-200 transition-colors cursor-pointer border-none">إلغاء</button>
            <button onClick={handleEdit} disabled={!editName.trim()} className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer border-none disabled:opacity-50">حفظ</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
