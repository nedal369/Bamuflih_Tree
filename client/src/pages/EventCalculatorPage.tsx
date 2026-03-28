import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import LoadingSpinner from '../components/common/LoadingSpinner';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface CustomRule {
  id: number;
  name: string;
  condition_type: 'age_above' | 'age_below' | 'free' | 'full_price';
  condition_value?: number;
  cost_multiplier: number;
  enabled: boolean;
}

interface EventForm {
  name: string;
  date: string;
  description: string;
  adult_cost: number;
  child_age_max: number;
  young_age_max: number;
  young_cost_multiplier: number;
  child_cost_multiplier: number;
  exempt_non_bamuflih_spouses: boolean;
  exempt_their_children: boolean;
  custom_rules: CustomRule[];
  notes: string;
  status: string;
}

interface FundEvent {
  id: number;
  name: string;
  date?: string;
  description?: string;
  adult_cost: number;
  child_age_max: number;
  young_age_max: number;
  young_cost_multiplier: number;
  child_cost_multiplier: number;
  exempt_non_bamuflih_spouses: number;
  exempt_their_children: number;
  custom_rules: CustomRule[];
  notes?: string;
  status: string;
  attendee_count: number;
  created_at: string;
}

interface Attendee {
  id: number;
  member_id?: number;
  guest_name?: string;
  member_name?: string;
  category: string;
  cost_override?: number;
  free_reason?: string;
  auto_category: string;
  auto_cost: number;
  auto_reason: string;
  final_cost: number;
  final_category: string;
  birth_date?: string;
  gender?: string;
}

const defaultForm: EventForm = {
  name: '',
  date: '',
  description: '',
  adult_cost: 500,
  child_age_max: 6,
  young_age_max: 15,
  young_cost_multiplier: 0.5,
  child_cost_multiplier: 0,
  exempt_non_bamuflih_spouses: true,
  exempt_their_children: true,
  custom_rules: [],
  notes: '',
  status: 'planning',
};

const categoryColors: Record<string, string> = {
  adult: 'bg-blue-100 text-blue-800',
  young: 'bg-yellow-100 text-yellow-800',
  child: 'bg-green-100 text-green-800',
  free: 'bg-gray-100 text-gray-600',
  custom: 'bg-purple-100 text-purple-800',
  deceased: 'bg-gray-100 text-gray-400',
};

const categoryLabels: Record<string, string> = {
  adult: 'بالغ',
  young: 'صغير',
  child: 'طفل',
  free: 'مجاني',
  custom: 'مخصص',
  deceased: 'متوفى',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: 'تخطيط', color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'مؤكد', color: 'bg-green-100 text-green-700' },
  completed: { label: 'منتهي', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'ملغى', color: 'bg-red-100 text-red-700' },
};

function formatAmount(n: number) {
  return n.toLocaleString('ar-SA') + ' ر.س';
}

function EventFormPanel({ initial, onSave, onCancel }: {
  initial: EventForm;
  onSave: (form: EventForm) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EventForm>(initial);
  const [newRule, setNewRule] = useState<Partial<CustomRule>>({
    name: '', condition_type: 'age_above', condition_value: 60, cost_multiplier: 0, enabled: true
  });

  const addRule = () => {
    if (!newRule.name) return;
    const rule: CustomRule = {
      id: Date.now(),
      name: newRule.name!,
      condition_type: newRule.condition_type!,
      condition_value: newRule.condition_value,
      cost_multiplier: newRule.cost_multiplier ?? 0,
      enabled: true,
    };
    setForm(f => ({ ...f, custom_rules: [...f.custom_rules, rule] }));
    setNewRule({ name: '', condition_type: 'age_above', condition_value: 60, cost_multiplier: 0, enabled: true });
  };

  const removeRule = (id: number) => setForm(f => ({ ...f, custom_rules: f.custom_rules.filter(r => r.id !== id) }));
  const toggleRule = (id: number) => setForm(f => ({
    ...f, custom_rules: f.custom_rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
  }));

  // Live cost preview
  const youngCost = form.adult_cost * form.young_cost_multiplier;
  const childCost = form.adult_cost * form.child_cost_multiplier;

  return (
    <div className="p-5 space-y-5" dir="rtl">
      {/* Basic Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-text mb-1">اسم المناسبة *</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            required placeholder="مثال: غداء عيد الأضحى 2025"
            className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">التاريخ</label>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">الحالة</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
            className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm">
            <option value="planning">تخطيط</option>
            <option value="confirmed">مؤكد</option>
            <option value="completed">منتهي</option>
            <option value="cancelled">ملغى</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-text mb-1">وصف / ملاحظات</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={2} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none" />
        </div>
      </div>

      {/* Pricing Rules */}
      <div className="border-t border-gray-100 pt-4">
        <h3 className="font-bold text-text mb-3">قواعد التسعير</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">تكلفة البالغ (ر.س)</label>
            <input type="number" value={form.adult_cost} onChange={e => setForm({ ...form, adult_cost: parseFloat(e.target.value) || 0 })}
              min={0} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">نسبة الصغير من البالغ</label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={1} step={0.1} value={form.young_cost_multiplier}
                onChange={e => setForm({ ...form, young_cost_multiplier: parseFloat(e.target.value) })}
                className="flex-1 accent-primary" />
              <span className="text-sm font-bold text-primary w-12 text-center">{Math.round(form.young_cost_multiplier * 100)}%</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">= {formatAmount(youngCost)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">نسبة الطفل من البالغ</label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={1} step={0.1} value={form.child_cost_multiplier}
                onChange={e => setForm({ ...form, child_cost_multiplier: parseFloat(e.target.value) })}
                className="flex-1 accent-primary" />
              <span className="text-sm font-bold text-primary w-12 text-center">{Math.round(form.child_cost_multiplier * 100)}%</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">= {formatAmount(childCost)}</p>
          </div>
        </div>

        {/* Age thresholds */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">الحد الأقصى لسن الطفل</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={18} value={form.child_age_max}
                onChange={e => setForm({ ...form, child_age_max: parseInt(e.target.value) || 0 })}
                className="w-24 px-3 py-2 bg-surface rounded-xl border-none text-sm" />
              <span className="text-sm text-text-secondary">سنة (وما دون)</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">الحد الأقصى لسن الصغير</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={30} value={form.young_age_max}
                onChange={e => setForm({ ...form, young_age_max: parseInt(e.target.value) || 0 })}
                className="w-24 px-3 py-2 bg-surface rounded-xl border-none text-sm" />
              <span className="text-sm text-text-secondary">سنة (وما دون)</span>
            </div>
          </div>
        </div>

        {/* Exemption toggles */}
        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" checked={form.exempt_non_bamuflih_spouses}
                onChange={e => setForm({ ...form, exempt_non_bamuflih_spouses: e.target.checked })}
                className="sr-only" />
              <div className={`w-10 h-6 rounded-full transition-colors ${form.exempt_non_bamuflih_spouses ? 'bg-green-500' : 'bg-gray-200'}`} />
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.exempt_non_bamuflih_spouses ? 'right-0.5' : 'left-0.5'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-text">أزواج بنات العائلة من خارج بامفلح = مجاني</p>
              <p className="text-xs text-text-secondary">المتزوجون من بنات الأسرة وهم من عائلات أخرى</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" checked={form.exempt_their_children}
                onChange={e => setForm({ ...form, exempt_their_children: e.target.checked })}
                className="sr-only" />
              <div className={`w-10 h-6 rounded-full transition-colors ${form.exempt_their_children ? 'bg-green-500' : 'bg-gray-200'}`} />
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.exempt_their_children ? 'right-0.5' : 'left-0.5'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-text">أبناء أزواج بنات العائلة من خارج بامفلح = مجاني</p>
              <p className="text-xs text-text-secondary">أبناء هؤلاء الأزواج يحضرون مجاناً</p>
            </div>
          </label>
        </div>
      </div>

      {/* Custom Rules */}
      <div className="border-t border-gray-100 pt-4">
        <h3 className="font-bold text-text mb-3">شروط مخصصة إضافية</h3>

        {form.custom_rules.length > 0 && (
          <div className="space-y-2 mb-3">
            {form.custom_rules.map(rule => (
              <div key={rule.id} className={`flex items-center gap-3 p-3 rounded-xl border ${rule.enabled ? 'bg-purple-50 border-purple-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                <button type="button" onClick={() => toggleRule(rule.id)}
                  className={`w-8 h-5 rounded-full transition-colors cursor-pointer border-none flex-shrink-0 ${rule.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text">{rule.name}</p>
                  <p className="text-xs text-text-secondary">
                    {rule.condition_type === 'age_above' && `العمر > ${rule.condition_value} سنة`}
                    {rule.condition_type === 'age_below' && `العمر < ${rule.condition_value} سنة`}
                    {rule.condition_type === 'free' && 'الجميع مجاناً'}
                    {rule.condition_type === 'full_price' && 'السعر الكامل'}
                    {' → '}{Math.round(rule.cost_multiplier * 100)}% من سعر البالغ
                  </p>
                </div>
                <button type="button" onClick={() => removeRule(rule.id)}
                  className="text-red-400 hover:text-red-600 cursor-pointer bg-transparent border-none text-lg flex-shrink-0">×</button>
              </div>
            ))}
          </div>
        )}

        {/* Add custom rule */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-text-secondary">إضافة شرط جديد</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={newRule.name || ''} onChange={e => setNewRule({ ...newRule, name: e.target.value })}
              placeholder="اسم الشرط (مثال: كبار السن مجاني)"
              className="px-3 py-2 bg-white rounded-xl border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <select value={newRule.condition_type} onChange={e => setNewRule({ ...newRule, condition_type: e.target.value as CustomRule['condition_type'] })}
              className="px-3 py-2 bg-white rounded-xl border-none text-sm">
              <option value="age_above">عمر أكبر من</option>
              <option value="age_below">عمر أصغر من</option>
              <option value="free">مجاني (للجميع)</option>
            </select>
            {(newRule.condition_type === 'age_above' || newRule.condition_type === 'age_below') && (
              <input type="number" value={newRule.condition_value || ''} onChange={e => setNewRule({ ...newRule, condition_value: parseInt(e.target.value) })}
                placeholder="السن (بالسنوات)"
                className="px-3 py-2 bg-white rounded-xl border-none text-sm" />
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-secondary whitespace-nowrap">النسبة %</label>
              <input type="number" min={0} max={100} value={Math.round((newRule.cost_multiplier || 0) * 100)}
                onChange={e => setNewRule({ ...newRule, cost_multiplier: parseInt(e.target.value) / 100 })}
                className="flex-1 px-3 py-2 bg-white rounded-xl border-none text-sm" />
            </div>
            <button type="button" onClick={addRule}
              className="px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium cursor-pointer border-none">
              + إضافة الشرط
            </button>
          </div>
        </div>
      </div>

      {/* Cost Summary Preview */}
      <div className="border-t border-gray-100 pt-4">
        <h3 className="font-bold text-text mb-3">ملخص التسعير</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'البالغ', cost: form.adult_cost, color: 'bg-blue-50 border-blue-100 text-blue-800' },
            { label: `الصغير (≤${form.young_age_max}س)`, cost: youngCost, color: 'bg-yellow-50 border-yellow-100 text-yellow-800' },
            { label: `الطفل (≤${form.child_age_max}س)`, cost: childCost, color: 'bg-green-50 border-green-100 text-green-800' },
            { label: 'المعفى', cost: 0, color: 'bg-gray-50 border-gray-100 text-gray-600' },
          ].map(item => (
            <div key={item.label} className={`p-3 rounded-xl border ${item.color}`}>
              <p className="text-xs font-medium mb-0.5">{item.label}</p>
              <p className="text-sm font-black">{formatAmount(item.cost)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={() => onSave(form)}
          className="flex-1 py-3 bg-primary text-white rounded-xl font-medium text-sm cursor-pointer border-none hover:bg-primary/90 transition-colors">
          حفظ الفعالية
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-3 bg-surface text-text rounded-xl font-medium text-sm cursor-pointer border-none">
          إلغاء
        </button>
      </div>
    </div>
  );
}

export default function EventCalculatorPage() {
  const [events, setEvents] = useState<FundEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FundEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<{ event: FundEvent & { attendees: Attendee[]; total_cost: number } } | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [attendeeFilter, setAttendeeFilter] = useState<'all' | 'adult' | 'young' | 'child' | 'free'>('all');
  const [searchAttendee, setSearchAttendee] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/fund/events');
      setEvents(res.data);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const loadEventDetail = async (id: number) => {
    try {
      const res = await api.get(`/fund/events/${id}`);
      setSelectedEvent({ event: res.data });
    } catch { alert('خطأ في تحميل الفعالية'); }
  };

  const handleCreate = async (form: EventForm) => {
    try {
      const res = await api.post('/fund/events', form);
      setShowCreate(false);
      await loadEvents();
      await loadEventDetail(res.data.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطأ في الإنشاء');
    }
  };

  const handleUpdate = async (form: EventForm) => {
    if (!editingEvent) return;
    try {
      await api.put(`/fund/events/${editingEvent.id}`, form);
      setEditingEvent(null);
      await loadEvents();
      if (selectedEvent?.event.id === editingEvent.id) await loadEventDetail(editingEvent.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطأ في التحديث');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/fund/events/${id}`);
      setDeleteConfirm(null);
      if (selectedEvent?.event.id === id) setSelectedEvent(null);
      await loadEvents();
    } catch { alert('خطأ في الحذف'); }
  };

  const handleCalculate = async (eventId: number) => {
    setCalculating(true);
    try {
      await api.post(`/fund/events/${eventId}/calculate`);
      await loadEventDetail(eventId);
      await loadEvents();
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطأ في الحساب');
    }
    setCalculating(false);
  };

  const handleUpdateAttendee = async (eventId: number, attId: number, data: Partial<Attendee>) => {
    try {
      await api.put(`/fund/events/${eventId}/attendees/${attId}`, data);
      await loadEventDetail(eventId);
    } catch { alert('خطأ في التحديث'); }
  };

  const filteredAttendees = selectedEvent?.event.attendees.filter(a => {
    if (attendeeFilter !== 'all' && a.final_category !== attendeeFilter) return false;
    if (searchAttendee && !(a.member_name || a.guest_name || '').includes(searchAttendee)) return false;
    return true;
  }) || [];

  // Cost breakdown
  const breakdown = selectedEvent ? {
    adult: selectedEvent.event.attendees.filter(a => a.final_category === 'adult'),
    young: selectedEvent.event.attendees.filter(a => a.final_category === 'young'),
    child: selectedEvent.event.attendees.filter(a => a.final_category === 'child'),
    free: selectedEvent.event.attendees.filter(a => a.final_category === 'free'),
  } : null;

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6" dir="rtl">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-text">حاسبة تكلفة المناسبات</h1>
          <p className="text-text-secondary text-sm mt-1">خطط وأحسب تكلفة المناسبات العائلية تلقائياً</p>
        </div>
        {!showCreate && !editingEvent && (
          <button onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm cursor-pointer border-none flex items-center gap-2 flex-shrink-0">
            <span className="text-lg leading-none">+</span> مناسبة جديدة
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-text">إنشاء مناسبة جديدة</h2>
          </div>
          <EventFormPanel initial={defaultForm} onSave={handleCreate} onCancel={() => setShowCreate(false)} />
        </div>
      )}

      {/* Edit form */}
      {editingEvent && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-text">تعديل: {editingEvent.name}</h2>
          </div>
          <EventFormPanel
            initial={{
              name: editingEvent.name,
              date: editingEvent.date || '',
              description: editingEvent.description || '',
              adult_cost: editingEvent.adult_cost,
              child_age_max: editingEvent.child_age_max,
              young_age_max: editingEvent.young_age_max,
              young_cost_multiplier: editingEvent.young_cost_multiplier,
              child_cost_multiplier: editingEvent.child_cost_multiplier,
              exempt_non_bamuflih_spouses: !!editingEvent.exempt_non_bamuflih_spouses,
              exempt_their_children: !!editingEvent.exempt_their_children,
              custom_rules: editingEvent.custom_rules || [],
              notes: editingEvent.notes || '',
              status: editingEvent.status,
            }}
            onSave={handleUpdate}
            onCancel={() => setEditingEvent(null)}
          />
        </div>
      )}

      <div className={`grid gap-6 ${selectedEvent ? 'lg:grid-cols-5' : 'grid-cols-1'}`}>
        {/* Events list */}
        <div className={selectedEvent ? 'lg:col-span-2' : ''}>
          {events.length === 0 && !showCreate ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <p className="text-text font-medium mb-2">لا توجد مناسبات</p>
              <p className="text-text-secondary text-sm">أنشئ مناسبة جديدة لحساب تكلفتها</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(ev => {
                const statusMeta = statusLabels[ev.status] || { label: ev.status, color: 'bg-gray-100 text-gray-600' };
                const isSelected = selectedEvent?.event.id === ev.id;
                return (
                  <div key={ev.id}
                    className={`bg-white rounded-2xl shadow-sm border overflow-hidden cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100 hover:border-gray-200'}`}
                    onClick={() => loadEventDetail(ev.id)}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-text text-sm truncate">{ev.name}</h3>
                          {ev.date && <p className="text-xs text-text-secondary mt-0.5">{ev.date}</p>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium flex-shrink-0 ${statusMeta.color}`}>{statusMeta.label}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                        <span>{ev.attendee_count} شخص</span>
                        <span>•</span>
                        <span>البالغ: {formatAmount(ev.adult_cost)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleCalculate(ev.id)} disabled={calculating}
                          className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium cursor-pointer border-none hover:bg-primary/20 transition-colors disabled:opacity-50">
                          {calculating ? '...' : 'حساب تلقائي'}
                        </button>
                        <button onClick={() => { setEditingEvent(ev); setSelectedEvent(null); }}
                          className="px-3 py-1.5 bg-surface text-text-secondary rounded-lg text-xs cursor-pointer border-none hover:bg-gray-100">
                          تعديل
                        </button>
                        {deleteConfirm === ev.id ? (
                          <>
                            <button onClick={() => handleDelete(ev.id)}
                              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium cursor-pointer border-none">تأكيد</button>
                            <button onClick={() => setDeleteConfirm(null)}
                              className="px-3 py-1.5 bg-surface text-text-secondary rounded-lg text-xs cursor-pointer border-none">إلغاء</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirm(ev.id)}
                            className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs cursor-pointer border-none hover:bg-red-100">
                            حذف
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Event detail / attendees */}
        {selectedEvent && (
          <div className="lg:col-span-3 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {breakdown && [
                { label: 'البالغون', count: breakdown.adult.length, cost: breakdown.adult.reduce((s,a)=>s+a.final_cost,0), color: 'text-blue-600' },
                { label: 'الصغار', count: breakdown.young.length, cost: breakdown.young.reduce((s,a)=>s+a.final_cost,0), color: 'text-yellow-600' },
                { label: 'الأطفال', count: breakdown.child.length, cost: breakdown.child.reduce((s,a)=>s+a.final_cost,0), color: 'text-green-600' },
                { label: 'المعفيون', count: breakdown.free.length, cost: 0, color: 'text-gray-500' },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                  <p className="text-xs text-text-secondary">{item.label}</p>
                  <p className={`text-lg font-black ${item.color}`}>{item.count}</p>
                  <p className="text-xs text-text-secondary">{formatAmount(item.cost)}</p>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="bg-primary rounded-2xl p-4 text-white text-center">
              <p className="text-sm opacity-80 mb-1">إجمالي التكلفة المقدرة</p>
              <p className="text-3xl font-black">{formatAmount(selectedEvent.event.total_cost)}</p>
              <p className="text-sm opacity-70 mt-1">{selectedEvent.event.attendees.length} شخص إجمالاً</p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'adult', 'young', 'child', 'free'] as const).map(f => (
                <button key={f} onClick={() => setAttendeeFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer border-none transition-colors ${attendeeFilter === f ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-surface'}`}>
                  {f === 'all' ? `الكل (${selectedEvent.event.attendees.length})` : `${categoryLabels[f]} (${selectedEvent.event.attendees.filter(a=>a.final_category===f).length})`}
                </button>
              ))}
              <input value={searchAttendee} onChange={e => setSearchAttendee(e.target.value)}
                placeholder="بحث..." className="px-3 py-1.5 bg-white rounded-xl border-none text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 flex-1 min-w-24" />
            </div>

            {/* Attendees table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="bg-surface/50 border-b border-gray-100">
                      <th className="px-4 py-3 text-start text-text-secondary font-medium text-xs">الاسم</th>
                      <th className="px-4 py-3 text-center text-text-secondary font-medium text-xs">الفئة</th>
                      <th className="px-4 py-3 text-start text-text-secondary font-medium text-xs">السبب</th>
                      <th className="px-4 py-3 text-start text-text-secondary font-medium text-xs">التكلفة</th>
                      <th className="px-4 py-3 text-start text-text-secondary font-medium text-xs">تعديل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendees.map(att => (
                      <tr key={att.id} className="border-b border-gray-50 hover:bg-surface/30">
                        <td className="px-4 py-2.5 font-medium">{att.member_name || att.guest_name || '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${categoryColors[att.final_category] || ''}`}>
                            {categoryLabels[att.final_category] || att.final_category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-text-secondary">{att.free_reason || att.auto_reason}</td>
                        <td className="px-4 py-2.5 font-bold text-sm">{att.final_cost > 0 ? formatAmount(att.final_cost) : <span className="text-gray-400">مجاني</span>}</td>
                        <td className="px-4 py-2.5">
                          <select value={att.category}
                            onChange={e => handleUpdateAttendee(selectedEvent.event.id, att.id, { category: e.target.value, cost_override: e.target.value === 'free' ? 0 : e.target.value === 'adult' ? selectedEvent.event.adult_cost : e.target.value === 'young' ? selectedEvent.event.adult_cost * selectedEvent.event.young_cost_multiplier : 0 })}
                            className="px-2 py-1 bg-surface rounded-lg border-none text-xs cursor-pointer">
                            <option value="adult">بالغ</option>
                            <option value="young">صغير</option>
                            <option value="child">طفل</option>
                            <option value="free">مجاني</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {filteredAttendees.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-text-secondary text-sm">لا توجد نتائج</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
