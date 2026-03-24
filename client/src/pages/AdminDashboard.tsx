import { useEffect, useState, useCallback } from 'react';
import {
  getMembers, createMember, updateMember, deleteMember,
  uploadExcel, importExcelData, downloadExcel, getUsers, createUser, updateUserStatus, deleteUser,
  addMarriage, deleteMarriage, downloadGedcom, importGedcom,
} from '../services/api';
import type { Member, ExcelUploadResponse, User, Marriage } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

/* ─── Member Form ─── */
function MemberForm({ member, allMembers, onSave, onCancel }: {
  member?: Member; allMembers: Member[];
  onSave: (data: Partial<Member>) => void; onCancel: () => void;
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
    city: member?.city || '',
    nationality: member?.nationality || '',
    occupation: member?.occupation || '',
    work_type: member?.work_type || '',
    work_place: member?.work_place || '',
  });

  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...form, father_id: form.father_id ? Number(form.father_id) : null } as Partial<Member>); }} className="p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-text mb-1">الاسم *</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-text mb-1">الأب</label>
        <select value={form.father_id} onChange={e => setForm({ ...form, father_id: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm">
          <option value="">بدون أب</option>
          {allMembers.filter(m => m.id !== member?.id).map(m => (
            <option key={m.id} value={m.id}>{m.name} (الجيل {m.generation})</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">الجنس</label>
          <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value as 'male' | 'female' })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm">
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">الهاتف</label>
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">الأم</label>
          <input value={form.mother_name} onChange={e => setForm({ ...form, mother_name: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">المدينة</label>
          <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="مكة، جدة، المدينة..." />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">الجنسية</label>
          <input value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="سعودي، يمني..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">العمل</label>
          <input value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">نوع العمل</label>
          <select value={form.work_type} onChange={e => setForm({ ...form, work_type: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm">
            <option value="">غير محدد</option>
            <option value="حكومي">حكومي</option>
            <option value="خاص">خاص</option>
            <option value="عسكري">عسكري</option>
            <option value="حر">عمل حر</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">جهة العمل</label>
          <input value={form.work_place} onChange={e => setForm({ ...form, work_place: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="اسم الجهة أو الشركة" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">تاريخ الميلاد</label>
          <input value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">تاريخ الوفاة</label>
          <input value={form.death_date} onChange={e => setForm({ ...form, death_date: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="فارغ = على قيد الحياة" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text mb-1">ملاحظات</label>
        <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={2} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-dark transition-colors cursor-pointer border-none">{member ? 'تحديث' : 'إضافة'}</button>
        <button type="button" onClick={onCancel} className="px-6 py-3 bg-surface text-text rounded-xl font-medium text-sm cursor-pointer border-none">إلغاء</button>
      </div>
    </form>
  );
}

/* ─── Marriage Form ─── */
function MarriageForm({ memberId, onDone }: { memberId: number; onDone: () => void }) {
  const [wifeName, setWifeName] = useState('');
  const [status, setStatus] = useState<Marriage['status']>('married');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addMarriage(memberId, { wife_name: wifeName, status });
    setWifeName('');
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <input value={wifeName} onChange={e => setWifeName(e.target.value)} placeholder="اسم الزوجة" required className="flex-1 px-3 py-2 bg-surface rounded-lg border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      <select value={status} onChange={e => setStatus(e.target.value as Marriage['status'])} className="px-3 py-2 bg-surface rounded-lg border-none text-sm">
        <option value="married">متزوج</option>
        <option value="divorced">مطلق</option>
        <option value="widowed">أرمل</option>
        <option value="deceased">متوفاة</option>
      </select>
      <button type="submit" className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium cursor-pointer border-none">+</button>
    </form>
  );
}

/* ─── Create User Form ─── */
function CreateUserForm({ members, onDone }: { members: Member[]; onDone: () => void }) {
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'member' as 'admin' | 'member',
    member_id: '' as string | number,
    permission_type: 'own_subtree' as 'full_tree' | 'own_subtree' | 'custom_subtrees',
    allowed_subtrees: [] as number[],
  });
  const [error, setError] = useState('');

  // Get generation-2 members (branch roots) for subtree selection
  const branchRoots = members.filter(m => m.generation === 2 && m.gender === 'male');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createUser({
        username: form.username,
        password: form.password,
        full_name: form.full_name || undefined,
        role: form.role,
        member_id: form.member_id ? Number(form.member_id) : null,
        permission_type: form.role === 'admin' ? 'full_tree' : form.permission_type,
        allowed_subtrees: form.permission_type === 'custom_subtrees' ? form.allowed_subtrees : [],
      });
      onDone();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { error?: string } } }).response?.data?.error : 'حدث خطأ';
      setError(msg || 'حدث خطأ');
    }
  };

  const toggleSubtree = (id: number) => {
    setForm(f => ({
      ...f,
      allowed_subtrees: f.allowed_subtrees.includes(id)
        ? f.allowed_subtrees.filter(s => s !== id)
        : [...f.allowed_subtrees, id]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && <div className="bg-danger/10 text-danger rounded-xl p-3 text-sm">{error}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">اسم المستخدم *</label>
          <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">كلمة المرور *</label>
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">الاسم الكامل</label>
          <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">الدور</label>
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'member' })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm">
            <option value="member">عضو</option>
            <option value="admin">مدير</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text mb-1">ربط بعضو في الشجرة</label>
        <select value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm">
          <option value="">غير مرتبط</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name} (الجيل {m.generation})</option>)}
        </select>
      </div>
      {form.role !== 'admin' && (
        <div>
          <label className="block text-sm font-medium text-text mb-1">صلاحيات التعديل</label>
          <select value={form.permission_type} onChange={e => setForm({ ...form, permission_type: e.target.value as typeof form.permission_type })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm">
            <option value="own_subtree">شجرته الفرعية فقط (حسب العضو المرتبط)</option>
            <option value="full_tree">جميع الشجرة</option>
            <option value="custom_subtrees">شجرات فرعية مخصصة</option>
          </select>
        </div>
      )}
      {form.role !== 'admin' && form.permission_type === 'custom_subtrees' && (
        <div>
          <label className="block text-sm font-medium text-text mb-2">اختر الشجرات الفرعية المسموحة</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-surface rounded-xl">
            {branchRoots.map(m => (
              <label key={m.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${form.allowed_subtrees.includes(m.id) ? 'bg-primary/10 text-primary' : 'bg-white text-text'}`}>
                <input type="checkbox" checked={form.allowed_subtrees.includes(m.id)} onChange={() => toggleSubtree(m.id)} className="accent-primary" />
                {m.name}
              </label>
            ))}
            {branchRoots.length === 0 && <p className="text-xs text-text-secondary col-span-full">لا توجد فروع متاحة</p>}
          </div>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-dark transition-colors cursor-pointer border-none">إنشاء المستخدم</button>
        <button type="button" onClick={onDone} className="px-6 py-3 bg-surface text-text rounded-xl font-medium text-sm cursor-pointer border-none">إلغاء</button>
      </div>
    </form>
  );
}

/* ─── Users Management ─── */
function UsersTab({ members }: { members: Member[] }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const loadUsers = useCallback(async () => {
    try { setUsers(await getUsers()); } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleApprove = async (id: number, memberId?: number) => {
    await updateUserStatus(id, { status: 'approved', role: 'member', member_id: memberId || null });
    loadUsers();
  };

  const handleReject = async (id: number) => {
    await updateUserStatus(id, { status: 'rejected' });
    loadUsers();
  };

  const handleDelete = async (id: number) => {
    await deleteUser(id);
    loadUsers();
  };

  const handleUpdatePermission = async (userId: number, permType: string, subtrees?: number[]) => {
    await updateUserStatus(userId, { permission_type: permType, allowed_subtrees: subtrees });
    loadUsers();
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-warning/10 text-warning',
    approved: 'bg-success/10 text-success',
    rejected: 'bg-danger/10 text-danger',
  };
  const statusLabels: Record<string, string> = { pending: 'بانتظار', approved: 'مقبول', rejected: 'مرفوض' };
  // Branch roots for subtree selection
  const branchRoots = members.filter(m => m.generation === 2 && m.gender === 'male');

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreateForm(true)} className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm cursor-pointer border-none flex items-center gap-2">
          <span className="text-lg leading-none">+</span> إضافة مستخدم
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-bold text-text">إنشاء مستخدم جديد</h3>
          </div>
          <CreateUserForm members={members} onDone={() => { setShowCreateForm(false); loadUsers(); }} />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface/50 border-b border-gray-100">
                <th className="px-4 py-3 text-start font-medium text-text-secondary">المستخدم</th>
                <th className="px-4 py-3 text-start font-medium text-text-secondary">الاسم</th>
                <th className="px-4 py-3 text-start font-medium text-text-secondary">الحالة</th>
                <th className="px-4 py-3 text-start font-medium text-text-secondary">العضو المرتبط</th>
                <th className="px-4 py-3 text-start font-medium text-text-secondary hidden lg:table-cell">الصلاحيات</th>
                <th className="px-4 py-3 text-start font-medium text-text-secondary">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-text-secondary">{u.full_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusColors[u.status] || ''}`}>
                      {statusLabels[u.status] || u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'admin' ? <span className="text-primary font-medium text-xs">مدير</span> : (
                      <select
                        value={u.member_id || ''}
                        onChange={e => handleApprove(u.id, e.target.value ? Number(e.target.value) : undefined)}
                        className="px-2 py-1 bg-surface rounded-lg border-none text-xs"
                      >
                        <option value="">غير مرتبط</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {u.role === 'admin' ? (
                      <span className="text-xs text-primary font-medium">كامل</span>
                    ) : (
                      <div className="space-y-1">
                        <select
                          value={u.permission_type || 'own_subtree'}
                          onChange={e => handleUpdatePermission(u.id, e.target.value, e.target.value === 'custom_subtrees' ? u.allowed_subtrees : [])}
                          className="px-2 py-1 bg-surface rounded-lg border-none text-xs"
                        >
                          <option value="own_subtree">شجرته فقط</option>
                          <option value="full_tree">جميع الشجرة</option>
                          <option value="custom_subtrees">شجرات مخصصة</option>
                        </select>
                        {u.permission_type === 'custom_subtrees' && (
                          <div>
                            <button onClick={() => setEditingUser(editingUser?.id === u.id ? null : u)} className="text-xs text-primary cursor-pointer bg-transparent border-none underline">
                              {u.allowed_subtrees?.length ? `${u.allowed_subtrees.length} شجرات` : 'اختر'} &#9998;
                            </button>
                            {editingUser?.id === u.id && (
                              <div className="mt-1 p-2 bg-surface rounded-lg max-h-32 overflow-y-auto">
                                {branchRoots.map(m => (
                                  <label key={m.id} className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer">
                                    <input type="checkbox" checked={u.allowed_subtrees?.includes(m.id) || false}
                                      onChange={() => {
                                        const current = u.allowed_subtrees || [];
                                        const next = current.includes(m.id) ? current.filter(s => s !== m.id) : [...current, m.id];
                                        handleUpdatePermission(u.id, 'custom_subtrees', next);
                                      }}
                                      className="accent-primary" />
                                    {m.name}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== 'admin' && (
                      <div className="flex gap-1">
                        {u.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(u.id)} className="px-2 py-1 bg-success/10 text-success rounded-lg text-xs font-medium cursor-pointer border-none">قبول</button>
                            <button onClick={() => handleReject(u.id)} className="px-2 py-1 bg-danger/10 text-danger rounded-lg text-xs font-medium cursor-pointer border-none">رفض</button>
                          </>
                        )}
                        <button onClick={() => handleDelete(u.id)} className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs cursor-pointer border-none">حذف</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Excel Import ─── */
function ExcelImport({ onDone }: { onDone: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<ExcelUploadResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; updated?: number; errors: { name: string; error: string }[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try { setPreview(await uploadExcel(file)); } catch { alert('خطأ في رفع الملف'); } finally { setUploading(false); }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try { setResult(await importExcelData(preview.data)); onDone(); } catch { alert('خطأ في الاستيراد'); } finally { setImporting(false); }
  };

  if (result) return (
    <div className="p-6">
      <div className="bg-success/10 text-success rounded-xl p-4 mb-4">تم استيراد {result.imported} عضو جديد{result.updated ? ` وتحديث ${result.updated} عضو` : ''} بنجاح</div>
      {result.errors.length > 0 && (
        <div className="bg-danger/10 text-danger rounded-xl p-4">
          {result.errors.map((e, i) => <p key={i} className="text-sm">{e.name}: {e.error}</p>)}
        </div>
      )}
    </div>
  );

  if (preview) return (
    <div className="p-6">
      <p className="text-sm text-text-secondary mb-4">{preview.message}</p>
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead><tr className="bg-surface">{preview.columns.map(c => <th key={c} className="px-3 py-2 text-start font-medium text-text-secondary">{c}</th>)}</tr></thead>
          <tbody>{preview.data.slice(0, 5).map((row, i) => <tr key={i} className="border-b border-gray-50">{preview.columns.map(c => <td key={c} className="px-3 py-2">{row[c] ?? ''}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="flex gap-3">
        <button onClick={handleImport} disabled={importing} className="flex-1 py-3 bg-success text-white rounded-xl font-medium text-sm cursor-pointer border-none disabled:opacity-50">{importing ? 'جاري...' : `استيراد ${preview.data.length} سجل`}</button>
        <button onClick={() => setPreview(null)} className="px-6 py-3 bg-surface text-text rounded-xl font-medium text-sm cursor-pointer border-none">إلغاء</button>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
        {uploading ? <LoadingSpinner /> : (
          <>
            <p className="text-text font-medium mb-2">اسحب ملف Excel هنا</p>
            <label className="px-6 py-3 bg-primary text-white rounded-xl font-medium text-sm cursor-pointer">
              اختر ملف
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── GEDCOM Tab ─── */
function GedcomTab({ onDone }: { onDone: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ imported?: number; families?: number; errors?: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true); setResult(null);
    try {
      const res = await importGedcom(file);
      setResult(res);
      onDone();
    } catch { setResult({ errors: ['حدث خطأ في استيراد الملف'] }); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-text">تصدير GEDCOM</h3>
        </div>
        <div className="p-6">
          <p className="text-sm text-text-secondary mb-4">صدّر بيانات الشجرة بصيغة GEDCOM 5.5.1 المعتمدة عالمياً للاستخدام في برامج الأنساب الأخرى.</p>
          <button onClick={async () => { try { await downloadGedcom(); } catch { alert('خطأ في التصدير'); } }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium text-sm cursor-pointer border-none hover:bg-indigo-700 transition-colors flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            تصدير ملف GEDCOM
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-text">استيراد ملف GEDCOM</h3>
        </div>
        <div className="p-6">
          <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
            {uploading ? <LoadingSpinner /> : (
              <>
                <p className="text-text font-medium mb-2">اسحب ملف GEDCOM هنا</p>
                <p className="text-xs text-text-secondary mb-4">يدعم صيغة .ged و .gedcom</p>
                <label className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium text-sm cursor-pointer">
                  اختر ملف
                  <input type="file" accept=".ged,.gedcom" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </label>
              </>
            )}
          </div>
          {result && (
            <div className="mt-4 p-4 bg-surface rounded-xl">
              {result.imported !== undefined && <p className="text-sm text-success font-medium">تم استيراد {result.imported} فرد و {result.families} عائلة</p>}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-danger font-medium">أخطاء ({result.errors.length}):</p>
                  <ul className="text-xs text-text-secondary mt-1 max-h-32 overflow-y-auto">
                    {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                    {result.errors.length > 10 && <li>... و {result.errors.length - 10} أخطاء أخرى</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function AdminDashboard() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'members' | 'users' | 'excel' | 'gedcom'>('members');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | undefined>();
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [marriageMemberId, setMarriageMemberId] = useState<number | null>(null);

  const loadMembers = useCallback(async () => {
    try { setMembers(await getMembers()); } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleSave = async (data: Partial<Member>) => {
    try {
      if (editingMember) await updateMember(editingMember.id, data);
      else await createMember(data);
      setShowForm(false); setEditingMember(undefined); loadMembers();
    } catch { alert('حدث خطأ'); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteMember(id); setDeleteConfirm(null); loadMembers(); } catch { alert('حدث خطأ'); }
  };

  const handleDeleteMarriage = async (id: number) => {
    try { await deleteMarriage(id); loadMembers(); } catch { }
  };

  const filtered = members.filter(m => m.name.includes(search));

  const tabs = [
    { key: 'members' as const, label: 'إدارة الأعضاء' },
    { key: 'users' as const, label: 'إدارة المستخدمين' },
    { key: 'excel' as const, label: 'استيراد Excel' },
    { key: 'gedcom' as const, label: 'GEDCOM' },
  ];

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-text">لوحة التحكم</h1>
        <div className="text-sm text-text-secondary">إجمالي الأعضاء: {members.length}</div>
      </div>

      <div className="flex gap-1 bg-surface p-1 rounded-xl mb-6 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border-none ${tab === t.key ? 'bg-white text-text shadow-sm' : 'text-text-secondary bg-transparent'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'members' && (
        <>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <input type="text" placeholder="بحث عن عضو..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 bg-white rounded-xl border border-gray-200 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <button onClick={() => { setEditingMember(undefined); setShowForm(true); }}
              className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm cursor-pointer border-none flex items-center gap-2">
              <span className="text-lg leading-none">+</span> إضافة عضو
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface/50 border-b border-gray-100">
                    <th className="px-4 py-3 text-start font-medium text-text-secondary">الاسم</th>
                    <th className="px-4 py-3 text-start font-medium text-text-secondary hidden sm:table-cell">الجيل</th>
                    <th className="px-4 py-3 text-start font-medium text-text-secondary hidden md:table-cell">المدينة</th>
                    <th className="px-4 py-3 text-start font-medium text-text-secondary hidden lg:table-cell">الزوجات</th>
                    <th className="px-4 py-3 text-start font-medium text-text-secondary">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-surface/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${m.gender === 'female' ? 'bg-pink-500' : 'bg-primary'}`} />
                          <span className="font-medium text-text">{m.name}</span>
                          {m.death_date && <span className="text-xs">🕊️</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{m.generation}</td>
                      <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{m.city || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {m.marriages?.map((mr, i) => (
                            <span key={i} className={`px-1.5 py-0.5 rounded text-xs ${mr.status === 'divorced' ? 'bg-gray-100 text-gray-400' : mr.status === 'deceased' ? 'bg-gray-100 text-gray-500' : 'bg-pink-50 text-pink-600'}`}>
                              {mr.wife_name}
                              <button onClick={() => handleDeleteMarriage(mr.id)} className="ms-1 text-gray-400 hover:text-danger cursor-pointer bg-transparent border-none text-xs">×</button>
                            </span>
                          ))}
                          <button onClick={() => setMarriageMemberId(marriageMemberId === m.id ? null : m.id)}
                            className="px-1.5 py-0.5 rounded text-xs bg-pink-50 text-pink-400 cursor-pointer border-none">+</button>
                        </div>
                        {marriageMemberId === m.id && <div className="mt-2"><MarriageForm memberId={m.id} onDone={() => { setMarriageMemberId(null); loadMembers(); }} /></div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingMember(m); setShowForm(true); }}
                            className="px-2 py-1 text-primary bg-primary/10 rounded-lg text-xs font-medium cursor-pointer border-none">تعديل</button>
                          {deleteConfirm === m.id ? (
                            <>
                              <button onClick={() => handleDelete(m.id)} className="px-2 py-1 text-white bg-danger rounded-lg text-xs cursor-pointer border-none">تأكيد</button>
                              <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-surface rounded-lg text-xs cursor-pointer border-none">إلغاء</button>
                            </>
                          ) : (
                            <button onClick={() => setDeleteConfirm(m.id)} className="px-2 py-1 text-danger bg-danger/10 rounded-lg text-xs cursor-pointer border-none">حذف</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'users' && <UsersTab members={members} />}

      {tab === 'excel' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-text">تحميل ملف Excel</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-text-secondary mb-4">حمّل جميع بيانات الشجرة كملف Excel، عدّل عليه ثم أعد رفعه لتحديث البيانات.</p>
              <button
                onClick={async () => { try { await downloadExcel(); } catch { alert('خطأ في تحميل الملف'); } }}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium text-sm cursor-pointer border-none hover:bg-emerald-700 transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                تحميل ملف Excel
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-text">رفع / استيراد ملف Excel</h3>
            </div>
            <ExcelImport onDone={loadMembers} />
          </div>
        </div>
      )}

      {tab === 'gedcom' && <GedcomTab onDone={loadMembers} />}

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditingMember(undefined); }}
        title={editingMember ? `تعديل: ${editingMember.name}` : 'إضافة عضو جديد'} size="lg">
        <MemberForm member={editingMember} allMembers={members} onSave={handleSave} onCancel={() => { setShowForm(false); setEditingMember(undefined); }} />
      </Modal>
    </div>
  );
}
