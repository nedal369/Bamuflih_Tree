import { useEffect, useState, useCallback } from 'react';
import {
  getMembers, createMember, updateMember, deleteMember,
  uploadExcel, importExcelData, downloadExcel, getUsers, createUser, updateUserStatus, deleteUser,
  addMarriage, deleteMarriage, downloadGedcom, importGedcom,
  getActivityLog, revertActivity,
  getAlliedFamilies, createAlliedFamily, deleteAlliedFamily, addFamilyMember,
} from '../services/api';
import type { Member, ExcelUploadResponse, User, Marriage, ActivityLog, AlliedFamily } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

/* ─── Searchable Member Picker ─── */
function MemberPicker({ label, members, selectedId, onSelect, excludeIds, placeholder }: {
  label: string; members: Member[]; selectedId: number | string | null;
  onSelect: (id: number | null) => void; excludeIds?: number[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = query.trim()
    ? members.filter(m => !(excludeIds || []).includes(m.id) && m.name.includes(query.trim())).slice(0, 12)
    : [];
  const selected = members.find(m => m.id === Number(selectedId));

  return (
    <div>
      <label className="block text-sm font-medium text-text mb-1">{label}</label>
      {selected ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${selected.gender === 'female' ? 'bg-pink-100 text-pink-600' : 'bg-primary/10 text-primary'}`}>
            {selected.gender === 'female' ? '♀' : '♂'}
          </div>
          <span className="flex-1 text-sm font-medium text-text truncate">{selected.name}</span>
          <span className="text-xs text-text-secondary">الجيل {selected.generation}</span>
          <button type="button" onClick={() => onSelect(null)} className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-danger text-xs cursor-pointer">✕</button>
        </div>
      ) : (
        <div className="relative">
          <input type="text" value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => query.trim() && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder || 'ابحث بالاسم...'} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          {open && filtered.length > 0 && (
            <ul className="absolute z-30 top-full mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 max-h-48 overflow-y-auto">
              {filtered.map(m => (
                <li key={m.id}>
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onSelect(m.id); setQuery(''); setOpen(false); }}
                    className="w-full text-start px-4 py-2.5 flex items-center gap-2 hover:bg-surface transition-colors text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${m.gender === 'female' ? 'bg-pink-100 text-pink-600' : 'bg-primary/10 text-primary'}`}>{m.gender === 'female' ? '♀' : '♂'}</span>
                    <span className="truncate">{m.name}</span>
                    <span className="text-xs text-text-secondary ms-auto">الجيل {m.generation}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Member Form ─── */
interface MemberFormResult {
  memberData: Partial<Member>;
  wives: { name: string; wife_id?: number | null; status: string }[];
  children: { name: string; gender: string; existingId?: number }[];
}

function MemberForm({ member, allMembers, onSave, onCancel }: {
  member?: Member; allMembers: Member[];
  onSave: (result: MemberFormResult) => void; onCancel: () => void;
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
    whatsapp: member?.whatsapp || '',
    twitter: member?.twitter || '',
    instagram: member?.instagram || '',
    snapchat: member?.snapchat || '',
    tiktok: member?.tiktok || '',
  });

  // Relationship additions (only for new members)
  const [wives, setWives] = useState<{ name: string; wife_id?: number | null; status: string }[]>([]);
  const [newWifeName, setNewWifeName] = useState('');
  const [newWifeStatus, setNewWifeStatus] = useState('married');
  const [wifeMode, setWifeMode] = useState<'new' | 'existing'>('new');
  const [children, setChildren] = useState<{ name: string; gender: string; existingId?: number }[]>([]);
  const [newChildName, setNewChildName] = useState('');
  const [newChildGender, setNewChildGender] = useState('male');
  const [childMode, setChildMode] = useState<'new' | 'existing'>('new');
  // Get father's wives for mother selection
  const fatherId = form.father_id ? Number(form.father_id) : null;
  const father = fatherId ? allMembers.find(m => m.id === fatherId) : null;
  const fatherWives = father?.marriages || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const memberData = { ...form, father_id: form.father_id ? Number(form.father_id) : null } as Partial<Member>;
    onSave({ memberData, wives, children });
  };

  const addWife = () => {
    if (!newWifeName.trim()) return;
    setWives([...wives, { name: newWifeName.trim(), status: newWifeStatus }]);
    setNewWifeName(''); setNewWifeStatus('married');
  };

  const addExistingWife = (memberId: number) => {
    const m = allMembers.find(x => x.id === memberId);
    if (!m) return;
    setWives([...wives, { name: m.name, wife_id: m.id, status: 'married' }]);
  };

  const addChild = () => {
    if (!newChildName.trim()) return;
    setChildren([...children, { name: newChildName.trim(), gender: newChildGender }]);
    setNewChildName(''); setNewChildGender('male');
  };

  const addExistingChild = (memberId: number) => {
    const m = allMembers.find(x => x.id === memberId);
    if (!m) return;
    setChildren([...children, { name: m.name, gender: m.gender, existingId: m.id }]);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-text mb-1">الاسم *</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" required />
      </div>

      {/* Father - searchable */}
      <MemberPicker
        label="الأب"
        members={allMembers.filter(m => m.id !== member?.id && m.gender === 'male')}
        selectedId={form.father_id || null}
        onSelect={id => setForm({ ...form, father_id: id || '', mother_name: '' })}
        placeholder="ابحث عن الأب..."
      />

      {/* Mother - depends on father */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">الأم</label>
        {fatherId && fatherWives.length > 0 ? (
          <div className="space-y-2">
            <select
              value={form.mother_name}
              onChange={e => setForm({ ...form, mother_name: e.target.value })}
              className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            >
              <option value="">اختر الأم من زوجات الأب...</option>
              {fatherWives.map((w, i) => (
                <option key={i} value={w.wife_name}>
                  {w.wife_name} ({w.status === 'married' ? 'متزوجة' : w.status === 'divorced' ? 'مطلقة' : w.status === 'widowed' ? 'أرملة' : 'متوفاة'})
                </option>
              ))}
            </select>
            <p className="text-xs text-text-secondary">* يتم عرض زوجات وطليقات الأب المحدد فقط</p>
          </div>
        ) : fatherId && fatherWives.length === 0 ? (
          <div className="space-y-2">
            <input value={form.mother_name} onChange={e => setForm({ ...form, mother_name: e.target.value })}
              className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              placeholder="اسم الأم (لا توجد زوجات مسجلة للأب)" />
            <p className="text-xs text-warning">لا توجد زوجات مسجلة لهذا الأب. أدخل الاسم يدوياً أو أضف زوجة أولاً.</p>
          </div>
        ) : (
          <input value={form.mother_name} onChange={e => setForm({ ...form, mother_name: e.target.value })}
            className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            placeholder="اسم الأم" />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">المدينة</label>
          <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="مكة، جدة، المدينة..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">الجنسية</label>
          <input value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="سعودي، يمني..." />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">العمل</label>
          <input value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">جهة العمل</label>
          <input value={form.work_place} onChange={e => setForm({ ...form, work_place: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="اسم الجهة أو الشركة" />
        </div>
      </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">تاريخ الميلاد</label>
          <input value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">تاريخ الوفاة</label>
          <input value={form.death_date} onChange={e => setForm({ ...form, death_date: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="فارغ = على قيد الحياة" />
        </div>
      </div>
      <div className="border-t border-gray-100 pt-4 mt-2">
        <label className="block text-sm font-bold text-text mb-3">التواصل الاجتماعي</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">واتساب</label>
            <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="966XXXXXXXXX" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">X (تويتر)</label>
            <input value={form.twitter} onChange={e => setForm({ ...form, twitter: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="username" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">انستقرام</label>
            <input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="username" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">سناب شات</label>
            <input value={form.snapchat} onChange={e => setForm({ ...form, snapchat: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="username" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">تيك توك</label>
            <input value={form.tiktok} onChange={e => setForm({ ...form, tiktok: e.target.value })} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" placeholder="username" dir="ltr" />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text mb-1">ملاحظات</label>
        <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={2} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none" />
      </div>

      {/* ─── Wives Section (only for new male members) ─── */}
      {!member && form.gender === 'male' && (
        <div className="border-t border-gray-100 pt-4 mt-2">
          <label className="block text-sm font-bold text-text mb-3">الزوجات</label>
          {wives.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {wives.map((w, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-700 rounded-xl text-xs font-medium">
                  {w.name} ({w.status === 'married' ? 'متزوجة' : w.status === 'divorced' ? 'مطلقة' : 'أرملة'})
                  {w.wife_id && <span className="text-pink-400">(مرتبطة)</span>}
                  <button type="button" onClick={() => setWives(wives.filter((_, j) => j !== i))} className="text-pink-400 hover:text-danger cursor-pointer bg-transparent border-none">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setWifeMode('new')} className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none ${wifeMode === 'new' ? 'bg-pink-500 text-white' : 'bg-surface text-text-secondary'}`}>إضافة جديدة</button>
            <button type="button" onClick={() => setWifeMode('existing')} className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none ${wifeMode === 'existing' ? 'bg-pink-500 text-white' : 'bg-surface text-text-secondary'}`}>اختيار من الشجرة</button>
          </div>
          {wifeMode === 'new' ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={newWifeName} onChange={e => setNewWifeName(e.target.value)} placeholder="اسم الزوجة" className="flex-1 px-3 py-2.5 bg-surface rounded-xl border-none text-sm focus:outline-none focus:ring-2 focus:ring-pink-200" />
              <select value={newWifeStatus} onChange={e => setNewWifeStatus(e.target.value)} className="px-3 py-2.5 bg-surface rounded-xl border-none text-sm">
                <option value="married">متزوجة</option>
                <option value="divorced">مطلقة</option>
                <option value="widowed">أرملة</option>
                <option value="deceased">متوفاة</option>
              </select>
              <button type="button" onClick={addWife} className="px-4 py-2.5 bg-pink-500 text-white rounded-xl text-sm font-medium cursor-pointer border-none">+</button>
            </div>
          ) : (
            <MemberPicker
              label=""
              members={allMembers.filter(m => m.gender === 'female' && !wives.some(w => w.wife_id === m.id))}
              selectedId={null}
              onSelect={id => { if (id) addExistingWife(id); }}
              placeholder="ابحث عن زوجة من الشجرة..."
            />
          )}
        </div>
      )}

      {/* ─── Children Section (only for new male members) ─── */}
      {!member && form.gender === 'male' && (
        <div className="border-t border-gray-100 pt-4 mt-2">
          <label className="block text-sm font-bold text-text mb-3">الأبناء</label>
          {children.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {children.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-medium">
                  {c.gender === 'female' ? '♀' : '♂'} {c.name}
                  {c.existingId && <span className="text-blue-400">(مرتبط)</span>}
                  <button type="button" onClick={() => setChildren(children.filter((_, j) => j !== i))} className="text-blue-400 hover:text-danger cursor-pointer bg-transparent border-none">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setChildMode('new')} className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none ${childMode === 'new' ? 'bg-blue-500 text-white' : 'bg-surface text-text-secondary'}`}>إضافة جديد</button>
            <button type="button" onClick={() => setChildMode('existing')} className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none ${childMode === 'existing' ? 'bg-blue-500 text-white' : 'bg-surface text-text-secondary'}`}>اختيار من الشجرة</button>
          </div>
          {childMode === 'new' ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={newChildName} onChange={e => setNewChildName(e.target.value)} placeholder="اسم الابن/الابنة" className="flex-1 px-3 py-2.5 bg-surface rounded-xl border-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <select value={newChildGender} onChange={e => setNewChildGender(e.target.value)} className="px-3 py-2.5 bg-surface rounded-xl border-none text-sm">
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
              <button type="button" onClick={addChild} className="px-4 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium cursor-pointer border-none">+</button>
            </div>
          ) : (
            <MemberPicker
              label=""
              members={allMembers.filter(m => !children.some(c => c.existingId === m.id))}
              selectedId={null}
              onSelect={id => { if (id) addExistingChild(id); }}
              placeholder="ابحث عن ابن/ابنة من الشجرة..."
            />
          )}
        </div>
      )}

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
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 sm:items-end">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">اسم المستخدم *</label>
          <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">كلمة المرور *</label>
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
  const [result, setResult] = useState<{ imported: number; updated?: number; relationshipsLinked?: number; marriagesCreated?: number; errors: { name: string; error: string }[] } | null>(null);
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
      <div className="bg-success/10 text-success rounded-xl p-4 mb-4">
        تم استيراد {result.imported} عضو جديد
        {result.updated ? ` وتحديث ${result.updated} عضو` : ''}
        {result.relationshipsLinked ? ` وربط ${result.relationshipsLinked} علاقة أب-ابن` : ''}
        {result.marriagesCreated ? ` و${result.marriagesCreated} زواج` : ''}
        {' '}بنجاح
      </div>
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

/* ─── Activity Log Tab ─── */
function ActivityLogTab() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<{ entity_type?: string; action?: string }>({});
  const [reverting, setReverting] = useState<number | null>(null);
  const [confirmRevert, setConfirmRevert] = useState<number | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getActivityLog({ page, ...filter });
      setLogs(result.logs);
      setTotalPages(result.pages);
    } catch { }
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleRevert = async (id: number) => {
    setReverting(id);
    try {
      await revertActivity(id);
      setConfirmRevert(null);
      loadLogs();
    } catch { alert('خطأ في التراجع'); }
    setReverting(null);
  };

  const actionLabels: Record<string, { label: string; color: string }> = {
    create: { label: 'إضافة', color: 'bg-green-100 text-green-800' },
    update: { label: 'تعديل', color: 'bg-blue-100 text-blue-800' },
    delete: { label: 'حذف', color: 'bg-red-100 text-red-800' },
    import: { label: 'استيراد', color: 'bg-purple-100 text-purple-800' },
    revert_create: { label: 'تراجع (استعادة)', color: 'bg-amber-100 text-amber-800' },
    revert_update: { label: 'تراجع (تعديل)', color: 'bg-amber-100 text-amber-800' },
    revert_delete: { label: 'تراجع (حذف)', color: 'bg-amber-100 text-amber-800' },
    revert_import: { label: 'تراجع (استيراد)', color: 'bg-amber-100 text-amber-800' },
  };

  const entityLabels: Record<string, string> = { member: 'عضو', marriage: 'زواج', family: 'عائلة' };

  const canRevert = (action: string) => ['create', 'update', 'delete', 'import'].includes(action);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <select value={filter.entity_type || ''} onChange={e => { setFilter(f => ({ ...f, entity_type: e.target.value || undefined })); setPage(1); }}
          className="px-3 py-2 bg-surface rounded-xl border-none text-sm">
          <option value="">كل الأنواع</option>
          <option value="member">أعضاء</option>
          <option value="marriage">زواج</option>
          <option value="family">عائلات</option>
        </select>
        <select value={filter.action || ''} onChange={e => { setFilter(f => ({ ...f, action: e.target.value || undefined })); setPage(1); }}
          className="px-3 py-2 bg-surface rounded-xl border-none text-sm">
          <option value="">كل الإجراءات</option>
          <option value="create">إضافة</option>
          <option value="update">تعديل</option>
          <option value="delete">حذف</option>
          <option value="import">استيراد</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">لا توجد سجلات</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map(log => (
                <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-surface/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${actionLabels[log.action]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {actionLabels[log.action]?.label || log.action}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg text-xs bg-gray-100 text-gray-600">{entityLabels[log.entity_type] || log.entity_type}</span>
                      {log.entity_name && <span className="text-sm font-medium text-text">{log.entity_name}</span>}
                    </div>
                    {log.details && <p className="text-sm text-text-secondary m-0">{log.details}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                      <span>{new Date(log.created_at).toLocaleString('ar-SA')}</span>
                      {log.username && <span>بواسطة: {log.username}</span>}
                    </div>
                  </div>
                  {canRevert(log.action) && (
                    <div className="flex-shrink-0">
                      {confirmRevert === log.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleRevert(log.id)} disabled={reverting === log.id}
                            className="px-3 py-1.5 bg-danger text-white rounded-lg text-xs font-medium cursor-pointer border-none disabled:opacity-50">
                            {reverting === log.id ? '...' : 'تأكيد التراجع'}
                          </button>
                          <button onClick={() => setConfirmRevert(null)} className="px-2 py-1.5 bg-surface rounded-lg text-xs cursor-pointer border-none">إلغاء</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmRevert(log.id)}
                          className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium cursor-pointer border-none hover:bg-amber-100 transition-colors">
                          تراجع
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 bg-surface rounded-lg text-sm cursor-pointer border-none disabled:opacity-30">السابق</button>
              <span className="text-sm text-text-secondary">صفحة {page} من {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-3 py-1.5 bg-surface rounded-lg text-sm cursor-pointer border-none disabled:opacity-30">التالي</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Allied Families Tab ─── */
function AlliedFamiliesTab({ allMembers }: { allMembers: Member[] }) {
  const [families, setFamilies] = useState<AlliedFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newFamily, setNewFamily] = useState({ name: '', description: '' });
  const [showAddMember, setShowAddMember] = useState<number | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', gender: 'male', father_id: '', birth_date: '', city: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [linkMember, setLinkMember] = useState<{ familyId: number; memberId: string } | null>(null);

  const loadFamilies = useCallback(async () => {
    try { setFamilies(await getAlliedFamilies()); } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { loadFamilies(); }, [loadFamilies]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamily.name) return;
    try {
      await createAlliedFamily(newFamily);
      setNewFamily({ name: '', description: '' });
      setShowCreate(false);
      loadFamilies();
    } catch { alert('خطأ في إنشاء العائلة'); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteAlliedFamily(id); setDeleteConfirm(null); loadFamilies(); } catch { alert('خطأ في الحذف'); }
  };

  const handleAddMember = async (e: React.FormEvent, familyId: number) => {
    e.preventDefault();
    if (!memberForm.name) return;
    try {
      await addFamilyMember(familyId, {
        ...memberForm,
        father_id: memberForm.father_id ? Number(memberForm.father_id) : null,
      });
      setMemberForm({ name: '', gender: 'male', father_id: '', birth_date: '', city: '' });
      setShowAddMember(null);
      loadFamilies();
    } catch { alert('خطأ'); }
  };

  const handleLinkExisting = async (familyId: number, memberId: number) => {
    try {
      await updateMember(memberId, { family_id: familyId } as Partial<Member>);
      setLinkMember(null);
      loadFamilies();
    } catch { alert('خطأ'); }
  };

  // Find marriage connections between a family's members and main tree
  const getConnections = (familyId: number) => {
    const familyMemberIds = new Set(allMembers.filter(m => m.family_id === familyId).map(m => m.id));
    const connections: { allied: string; main: string; status: string }[] = [];

    for (const m of allMembers) {
      if (!m.marriages) continue;
      for (const mar of m.marriages) {
        const husbandInFamily = familyMemberIds.has(mar.husband_id);
        const wifeInFamily = mar.wife_id ? familyMemberIds.has(mar.wife_id) : false;
        if (husbandInFamily && !wifeInFamily) {
          const husband = allMembers.find(x => x.id === mar.husband_id);
          connections.push({ allied: husband?.name || '', main: mar.wife_name || '', status: mar.status });
        } else if (wifeInFamily && !husbandInFamily) {
          const wife = allMembers.find(x => x.id === mar.wife_id);
          const husband = allMembers.find(x => x.id === mar.husband_id);
          connections.push({ allied: wife?.name || '', main: husband?.name || '', status: mar.status });
        }
      }
    }
    return connections;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-text-secondary">أضف عائلات حليفة وأربطها بشجرتك عن طريق الزواج أو القرابة</p>
        <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm cursor-pointer border-none flex items-center gap-2">
          <span className="text-lg leading-none">+</span> عائلة جديدة
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-text mb-4">إنشاء عائلة حليفة</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input value={newFamily.name} onChange={e => setNewFamily({ ...newFamily, name: e.target.value })}
              placeholder="اسم العائلة *" required className="w-full px-4 py-3 bg-surface rounded-xl border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <input value={newFamily.description} onChange={e => setNewFamily({ ...newFamily, description: e.target.value })}
              placeholder="وصف (اختياري)" className="w-full px-4 py-3 bg-surface rounded-xl border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="flex gap-2">
              <button type="submit" className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium cursor-pointer border-none">إنشاء</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2.5 bg-surface rounded-xl text-sm cursor-pointer border-none">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {families.length === 0 && !showCreate ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">🤝</div>
          <p className="text-text-secondary">لم يتم إضافة عائلات حليفة بعد</p>
        </div>
      ) : (
        families.map(family => {
          const familyMembers = allMembers.filter(m => m.family_id === family.id);
          const connections = getConnections(family.id);

          return (
            <div key={family.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-text flex items-center gap-2 flex-wrap">
                      🏠 {family.name}
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-lg">{family.member_count || familyMembers.length} عضو</span>
                    </h3>
                    {family.description && <p className="text-sm text-text-secondary mt-1">{family.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button onClick={() => setShowAddMember(showAddMember === family.id ? null : family.id)}
                    className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium cursor-pointer border-none">+ عضو جديد</button>
                  <button onClick={() => setLinkMember(linkMember?.familyId === family.id ? null : { familyId: family.id, memberId: '' })}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium cursor-pointer border-none">ربط عضو موجود</button>
                  {deleteConfirm === family.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDelete(family.id)} className="px-2 py-1.5 bg-danger text-white rounded-lg text-xs cursor-pointer border-none">تأكيد</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1.5 bg-surface rounded-lg text-xs cursor-pointer border-none">إلغاء</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(family.id)} className="px-3 py-1.5 bg-danger/10 text-danger rounded-lg text-xs cursor-pointer border-none">حذف</button>
                  )}
                </div>
              </div>

              {/* Link existing member */}
              {linkMember?.familyId === family.id && (
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex gap-2 items-center">
                  <select value={linkMember.memberId} onChange={e => setLinkMember({ ...linkMember, memberId: e.target.value })}
                    className="flex-1 px-3 py-2 bg-white rounded-lg border-none text-sm">
                    <option value="">اختر عضو لربطه...</option>
                    {allMembers.filter(m => !m.family_id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <button onClick={() => linkMember.memberId && handleLinkExisting(family.id, Number(linkMember.memberId))}
                    disabled={!linkMember.memberId}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer border-none disabled:opacity-40">ربط</button>
                </div>
              )}

              {/* Add new member form */}
              {showAddMember === family.id && (
                <form onSubmit={e => handleAddMember(e, family.id)} className="px-6 py-3 bg-green-50 border-b border-green-100">
                  <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-5 gap-2">
                    <input value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })}
                      placeholder="الاسم *" required className="px-3 py-2 bg-white rounded-lg border-none text-sm" />
                    <select value={memberForm.gender} onChange={e => setMemberForm({ ...memberForm, gender: e.target.value })}
                      className="px-3 py-2 bg-white rounded-lg border-none text-sm">
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                    <select value={memberForm.father_id} onChange={e => setMemberForm({ ...memberForm, father_id: e.target.value })}
                      className="px-3 py-2 bg-white rounded-lg border-none text-sm">
                      <option value="">بدون أب</option>
                      {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <input value={memberForm.city} onChange={e => setMemberForm({ ...memberForm, city: e.target.value })}
                      placeholder="المدينة" className="px-3 py-2 bg-white rounded-lg border-none text-sm" />
                    <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium cursor-pointer border-none">إضافة</button>
                  </div>
                </form>
              )}

              {/* Marriage connections */}
              {connections.length > 0 && (
                <div className="px-6 py-3 bg-pink-50/50 border-b border-pink-100">
                  <p className="text-xs font-medium text-pink-700 mb-2">روابط الزواج مع شجرتنا:</p>
                  <div className="flex flex-wrap gap-2">
                    {connections.map((c, i) => (
                      <span key={i} className="px-2 py-1 bg-pink-100 text-pink-800 rounded-lg text-xs">
                        {c.allied} ↔ {c.main} ({c.status === 'married' ? 'متزوج' : c.status === 'divorced' ? 'مطلق' : c.status})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Members table */}
              {familyMembers.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface/50 border-b border-gray-100">
                        <th className="px-4 py-2 text-start text-text-secondary font-medium text-xs">الاسم</th>
                        <th className="px-4 py-2 text-start text-text-secondary font-medium text-xs">الجنس</th>
                        <th className="px-4 py-2 text-start text-text-secondary font-medium text-xs">الجيل</th>
                        <th className="px-4 py-2 text-start text-text-secondary font-medium text-xs">المدينة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {familyMembers.map(m => (
                        <tr key={m.id} className="border-b border-gray-50">
                          <td className="px-4 py-2 font-medium">{m.name}</td>
                          <td className="px-4 py-2 text-text-secondary">{m.gender === 'female' ? 'أنثى' : 'ذكر'}</td>
                          <td className="px-4 py-2 text-text-secondary">{m.generation}</td>
                          <td className="px-4 py-2 text-text-secondary">{m.city || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─── Main Dashboard ─── */
export default function AdminDashboard() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'members' | 'users' | 'excel' | 'gedcom' | 'families' | 'log'>('members');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | undefined>();
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [marriageMemberId, setMarriageMemberId] = useState<number | null>(null);

  const loadMembers = useCallback(async () => {
    try { setMembers(await getMembers()); } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleSave = async (result: MemberFormResult) => {
    try {
      if (editingMember) {
        await updateMember(editingMember.id, result.memberData);
      } else {
        // Create member first
        const newMember = await createMember(result.memberData);

        // Add wives if any (only for new male members)
        if (result.wives.length > 0 && result.memberData.gender === 'male') {
          for (const wife of result.wives) {
            await addMarriage(newMember.id, { wife_name: wife.name, wife_id: wife.wife_id || null, status: wife.status as 'married' | 'divorced' | 'widowed' | 'deceased' });
          }
        }

        // Add/link children if any
        if (result.children.length > 0) {
          const newGen = (newMember.generation || 1) + 1;
          for (const child of result.children) {
            if (child.existingId) {
              // Link existing member as child
              await updateMember(child.existingId, { father_id: newMember.id, generation: newGen } as Partial<Member>);
            } else {
              // Create new child
              await createMember({ name: child.name, father_id: newMember.id, gender: child.gender as 'male' | 'female', generation: newGen } as Partial<Member>);
            }
          }
        }
      }
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
    { key: 'members' as const, label: 'الأعضاء' },
    { key: 'users' as const, label: 'المستخدمين' },
    { key: 'families' as const, label: 'عائلات حليفة' },
    { key: 'log' as const, label: 'سجل التغييرات' },
    { key: 'excel' as const, label: 'Excel' },
    { key: 'gedcom' as const, label: 'GEDCOM' },
  ];

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-text">لوحة التحكم</h1>
        <div className="text-sm text-text-secondary">إجمالي الأعضاء: {members.length}</div>
      </div>

      <div className="mobile-tabs flex gap-1 bg-surface p-1 rounded-xl mb-4 sm:mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer border-none whitespace-nowrap ${tab === t.key ? 'bg-white text-text shadow-sm' : 'text-text-secondary bg-transparent'}`}>
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

      {tab === 'families' && <AlliedFamiliesTab allMembers={members} />}

      {tab === 'log' && <ActivityLogTab />}

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditingMember(undefined); }}
        title={editingMember ? `تعديل: ${editingMember.name}` : 'إضافة عضو جديد'} size="lg">
        <MemberForm member={editingMember} allMembers={members} onSave={handleSave} onCancel={() => { setShowForm(false); setEditingMember(undefined); }} />
      </Modal>
    </div>
  );
}
