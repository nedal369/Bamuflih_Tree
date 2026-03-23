import { useEffect, useState, useCallback } from 'react';
import {
  getMembers,
  createMember,
  updateMember,
  deleteMember,
  uploadExcel,
  importExcelData,
} from '../services/api';
import type { Member, ExcelUploadResponse } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

/* ─── Member Form ─── */
function MemberForm({
  member,
  allMembers,
  onSave,
  onCancel,
}: {
  member?: Member;
  allMembers: Member[];
  onSave: (data: Partial<Member>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: member?.name || '',
    father_id: member?.father_id ?? '',
    gender: (member?.gender || 'male') as 'male' | 'female',
    birth_date: member?.birth_date || '',
    death_date: member?.death_date || '',
    bio: member?.bio || '',
    phone: member?.phone || '',
    mother_name: member?.mother_name || '',
    spouse_name: member?.spouse_name || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      father_id: form.father_id ? Number(form.father_id) : null,
    } as Partial<Member>);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-text mb-1">الاسم *</label>
        <input
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">الأب</label>
        <select
          value={form.father_id}
          onChange={e => setForm({ ...form, father_id: e.target.value })}
          className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        >
          <option value="">بدون أب</option>
          {allMembers
            .filter(m => m.id !== member?.id)
            .map(m => (
              <option key={m.id} value={m.id}>
                {m.name} (الجيل {m.generation})
              </option>
            ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">الجنس</label>
          <select
            value={form.gender}
            onChange={e => setForm({ ...form, gender: e.target.value as 'male' | 'female' })}
            className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          >
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">الهاتف</label>
          <input
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">الأم</label>
          <input
            value={form.mother_name}
            onChange={e => setForm({ ...form, mother_name: e.target.value })}
            className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            placeholder="اسم الأم"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">الزوج/الزوجة</label>
          <input
            value={form.spouse_name}
            onChange={e => setForm({ ...form, spouse_name: e.target.value })}
            className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            placeholder="اسم الزوج/الزوجة"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">تاريخ الميلاد</label>
          <input
            value={form.birth_date}
            onChange={e => setForm({ ...form, birth_date: e.target.value })}
            className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            placeholder="1990"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">تاريخ الوفاة</label>
          <input
            value={form.death_date}
            onChange={e => setForm({ ...form, death_date: e.target.value })}
            className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            placeholder="فارغ = على قيد الحياة"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">السيرة</label>
        <textarea
          value={form.bio}
          onChange={e => setForm({ ...form, bio: e.target.value })}
          rows={3}
          className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-dark transition-colors cursor-pointer border-none">
          {member ? 'تحديث' : 'إضافة'}
        </button>
        <button type="button" onClick={onCancel} className="px-6 py-3 bg-surface text-text rounded-xl font-medium text-sm hover:bg-surface-dark transition-colors cursor-pointer border-none">
          إلغاء
        </button>
      </div>
    </form>
  );
}

/* ─── Excel Import ─── */
function ExcelImport({ onDone }: { onDone: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<ExcelUploadResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: { name: string; error: string }[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const data = await uploadExcel(file);
      setPreview(data);
    } catch {
      alert('خطأ في رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await importExcelData(preview.data);
      setResult(res);
      onDone();
    } catch {
      alert('خطأ في الاستيراد');
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (result) {
    return (
      <div className="p-6">
        <div className="bg-success/10 text-success rounded-xl p-4 mb-4">
          تم استيراد {result.imported} عضو بنجاح
        </div>
        {result.errors.length > 0 && (
          <div className="bg-danger/10 text-danger rounded-xl p-4">
            <p className="font-medium mb-2">أخطاء ({result.errors.length}):</p>
            {result.errors.map((e, i) => (
              <p key={i} className="text-sm">{e.name}: {e.error}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (preview) {
    return (
      <div className="p-6">
        <p className="text-sm text-text-secondary mb-4">{preview.message}</p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface">
                {preview.columns.map(col => (
                  <th key={col} className="px-3 py-2 text-start font-medium text-text-secondary">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.data.slice(0, 5).map((row, i) => (
                <tr key={i} className="border-b border-gray-50">
                  {preview.columns.map(col => (
                    <td key={col} className="px-3 py-2 text-text">{row[col] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {preview.data.length > 5 && (
            <p className="text-xs text-text-secondary mt-2">و {preview.data.length - 5} سجلات أخرى...</p>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={handleImport} disabled={importing} className="flex-1 py-3 bg-success text-white rounded-xl font-medium text-sm hover:opacity-90 transition-colors cursor-pointer border-none disabled:opacity-50">
            {importing ? 'جاري الاستيراد...' : `استيراد ${preview.data.length} سجل`}
          </button>
          <button onClick={() => setPreview(null)} className="px-6 py-3 bg-surface text-text rounded-xl font-medium text-sm cursor-pointer border-none">إلغاء</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-gray-200'
        }`}
      >
        {uploading ? (
          <LoadingSpinner />
        ) : (
          <>
            <svg className="mx-auto mb-4 text-text-secondary" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-text font-medium mb-2">اسحب ملف Excel هنا</p>
            <p className="text-text-secondary text-sm mb-4">أو</p>
            <label className="px-6 py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-dark transition-colors cursor-pointer">
              اختر ملف
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function AdminDashboard() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'members' | 'excel'>('members');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | undefined>();
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      const data = await getMembers();
      setMembers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleSave = async (data: Partial<Member>) => {
    try {
      if (editingMember) {
        await updateMember(editingMember.id, data);
      } else {
        await createMember(data);
      }
      setShowForm(false);
      setEditingMember(undefined);
      loadMembers();
    } catch {
      alert('حدث خطأ');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMember(id);
      setDeleteConfirm(null);
      loadMembers();
    } catch {
      alert('حدث خطأ');
    }
  };

  const filtered = members.filter(m => m.name.includes(search));

  const tabs = [
    { key: 'members' as const, label: 'إدارة الأعضاء' },
    { key: 'excel' as const, label: 'استيراد Excel' },
  ];

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-text">لوحة التحكم</h1>
        <div className="text-sm text-text-secondary">
          إجمالي الأعضاء: {members.length}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface p-1 rounded-xl mb-6 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border-none ${
              tab === t.key ? 'bg-white text-text shadow-sm' : 'text-text-secondary hover:text-text bg-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'members' && (
        <>
          {/* Actions Bar */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="بحث عن عضو..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 bg-white rounded-xl border border-gray-200 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={() => { setEditingMember(undefined); setShowForm(true); }}
              className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-dark transition-colors cursor-pointer border-none flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span>
              إضافة عضو
            </button>
          </div>

          {/* Members Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface/50 border-b border-gray-100">
                    <th className="px-4 py-3 text-start font-medium text-text-secondary">#</th>
                    <th className="px-4 py-3 text-start font-medium text-text-secondary">الاسم</th>
                    <th className="px-4 py-3 text-start font-medium text-text-secondary hidden sm:table-cell">الجنس</th>
                    <th className="px-4 py-3 text-start font-medium text-text-secondary hidden md:table-cell">الجيل</th>
                    <th className="px-4 py-3 text-start font-medium text-text-secondary hidden lg:table-cell">الميلاد</th>
                    <th className="px-4 py-3 text-start font-medium text-text-secondary hidden lg:table-cell">الوفاة</th>
                    <th className="px-4 py-3 text-start font-medium text-text-secondary">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-surface/30 transition-colors">
                      <td className="px-4 py-3 text-text-secondary">{m.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${m.gender === 'female' ? 'bg-pink-500' : 'bg-primary'}`} />
                          <span className="font-medium text-text">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{m.gender === 'male' ? 'ذكر' : 'أنثى'}</td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{m.generation}</td>
                      <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">{m.birth_date || '—'}</td>
                      <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">{m.death_date || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditingMember(m); setShowForm(true); }}
                            className="px-3 py-1.5 text-primary bg-primary/10 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer border-none"
                          >
                            تعديل
                          </button>
                          {deleteConfirm === m.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(m.id)}
                                className="px-3 py-1.5 text-white bg-danger rounded-lg text-xs font-medium cursor-pointer border-none"
                              >
                                تأكيد
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-3 py-1.5 text-text-secondary bg-surface rounded-lg text-xs font-medium cursor-pointer border-none"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(m.id)}
                              className="px-3 py-1.5 text-danger bg-danger/10 rounded-lg text-xs font-medium hover:bg-danger/20 transition-colors cursor-pointer border-none"
                            >
                              حذف
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                        لا توجد نتائج
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'excel' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-text">استيراد من ملف Excel</h3>
            <p className="text-sm text-text-secondary mt-1">
              ارفع ملف Excel يحتوي على أعمدة: الاسم، اسم الأب، الجنس، تاريخ الميلاد، تاريخ الوفاة
            </p>
          </div>
          <ExcelImport onDone={loadMembers} />
        </div>
      )}

      {/* Member Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingMember(undefined); }}
        title={editingMember ? `تعديل: ${editingMember.name}` : 'إضافة عضو جديد'}
        size="lg"
      >
        <MemberForm
          member={editingMember}
          allMembers={members}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingMember(undefined); }}
        />
      </Modal>
    </div>
  );
}
