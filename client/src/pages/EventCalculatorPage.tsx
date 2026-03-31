import { useEffect, useState, useCallback } from 'react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import api from '../services/api';
import type { FamilyHead, EventFamily, EventRates } from '../types';

// ─── Types ───
interface EventForm {
  name: string;
  date: string;
  notes: string;
  status: string;
  dinner_cost: number;
  venue_cost: number;
  hospitality_cost: number;
  other_cost: number;
  subscriber_exemptions: string[];
  non_subscriber_surcharge: number;
  child_age_max: number;
  young_age_max: number;
  young_cost_multiplier: number;
  child_cost_multiplier: number;
  exempt_non_bamuflih_spouses: boolean;
  exempt_their_children: boolean;
}

interface FundEvent {
  id: number;
  name: string;
  date?: string;
  notes?: string;
  status: string;
  dinner_cost: number;
  venue_cost: number;
  hospitality_cost: number;
  other_cost: number;
  subscriber_exemptions: string[];
  non_subscriber_surcharge: number;
  child_age_max: number;
  young_age_max: number;
  young_cost_multiplier: number;
  child_cost_multiplier: number;
  exempt_non_bamuflih_spouses: number;
  exempt_their_children: number;
  attendee_count?: number;
  families?: EventFamily[];
  family_total_cost?: number;
  rates?: EventRates;
}

// ─── Helpers ───
function fmt(n: number) {
  return n.toLocaleString('ar-SA') + ' ر.س';
}

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: 'تخطيط', color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'مؤكد', color: 'bg-green-100 text-green-700' },
  completed: { label: 'منتهي', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'ملغى', color: 'bg-red-100 text-red-700' },
};

const costItemLabels: Record<string, string> = {
  dinner: 'العشاء',
  venue: 'المكان',
  hospitality: 'الضيافة',
  other: 'أخرى',
};

const defaultForm: EventForm = {
  name: '',
  date: '',
  notes: '',
  status: 'planning',
  dinner_cost: 0,
  venue_cost: 0,
  hospitality_cost: 0,
  other_cost: 0,
  subscriber_exemptions: [],
  non_subscriber_surcharge: 0,
  child_age_max: 6,
  young_age_max: 15,
  young_cost_multiplier: 0.5,
  child_cost_multiplier: 0,
  exempt_non_bamuflih_spouses: true,
  exempt_their_children: true,
};

// ─── Toggle switch ───
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors border-none cursor-pointer flex-shrink-0 ${value ? 'bg-green-500' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${value ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  );
}

// ─── Event Form Panel ───
function EventFormPanel({ initial, onSave, onCancel }: {
  initial: EventForm;
  onSave: (form: EventForm) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EventForm>(initial);

  const totalCost = form.dinner_cost + form.venue_cost + form.hospitality_cost + form.other_cost;
  const exemptAmount = form.subscriber_exemptions.reduce((s, key) => {
    const map: Record<string, number> = { dinner: form.dinner_cost, venue: form.venue_cost, hospitality: form.hospitality_cost, other: form.other_cost };
    return s + (map[key] || 0);
  }, 0);
  const subscriberRate = totalCost - exemptAmount;
  const nonSubscriberRate = totalCost + form.non_subscriber_surcharge;
  const youngSubscriber = subscriberRate * form.young_cost_multiplier;
  const youngNonSubscriber = nonSubscriberRate * form.young_cost_multiplier;

  const toggleExemption = (key: string) => {
    setForm(f => ({
      ...f,
      subscriber_exemptions: f.subscriber_exemptions.includes(key)
        ? f.subscriber_exemptions.filter(k => k !== key)
        : [...f.subscriber_exemptions, key],
    }));
  };

  return (
    <div className="p-5 space-y-5" dir="rtl">
      {/* Basic Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-text mb-1">اسم المناسبة *</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="مثال: غداء عيد الأضحى 1446"
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
          <label className="block text-sm font-medium text-text mb-1">ملاحظات</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={2} className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none" />
        </div>
      </div>

      {/* Itemized Costs */}
      <div className="border-t border-gray-100 pt-4">
        <h3 className="font-bold text-text mb-3">إجمالي التكاليف</h3>
        <p className="text-xs text-text-secondary mb-2">أدخل التكلفة الإجمالية لكل بند (سيتم تقسيمها على عدد الحضور تلقائياً)</p>
        <div className="grid grid-cols-2 gap-3">
          {(['dinner', 'venue', 'hospitality', 'other'] as const).map(key => (
            <div key={key}>
              <label className="block text-xs font-medium text-text-secondary mb-1">إجمالي {costItemLabels[key]} (ر.س)</label>
              <input type="number" min={0} value={(form as any)[`${key}_cost`]}
                onChange={e => setForm({ ...form, [`${key}_cost`]: parseFloat(e.target.value) || 0 } as EventForm)}
                className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-blue-50 rounded-xl text-sm text-blue-700 font-medium">
          إجمالي جميع التكاليف: {fmt(totalCost)}
          <span className="text-xs opacity-70 block mt-1">سيُقسم على عدد الحضور لتحديد نصيب الفرد</span>
        </div>
      </div>

      {/* Subscriber Exemptions */}
      <div className="border-t border-gray-100 pt-4">
        <h3 className="font-bold text-text mb-1">إعفاءات المشتركين</h3>
        <p className="text-xs text-text-secondary mb-3">اختر التكاليف التي يتحملها الصندوق عن المشتركين</p>
        <div className="space-y-2">
          {(['dinner', 'venue', 'hospitality', 'other'] as const).map(key => {
            const cost = (form as any)[`${key}_cost`] as number;
            const isExempt = form.subscriber_exemptions.includes(key);
            return (
              <label key={key} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isExempt ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
                <Toggle value={isExempt} onChange={() => toggleExemption(key)} />
                <div className="flex-1">
                  <span className="text-sm font-medium text-text">{costItemLabels[key]}</span>
                  <span className="text-xs text-text-secondary mr-2">({fmt(cost)})</span>
                </div>
                {isExempt && <span className="text-xs text-green-600 font-medium">يتحمله الصندوق</span>}
              </label>
            );
          })}
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-text mb-1">رسوم إضافية على غير المشتركين (ر.س)</label>
          <input type="number" min={0} value={form.non_subscriber_surcharge}
            onChange={e => setForm({ ...form, non_subscriber_surcharge: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <p className="text-xs text-text-secondary mt-1">رسوم تضاف لغير المشتركين لتحفيزهم على الاشتراك</p>
        </div>
      </div>

      {/* Age Settings */}
      <div className="border-t border-gray-100 pt-4">
        <h3 className="font-bold text-text mb-3">إعدادات الفئات العمرية</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">حد سن الطفل (سنة وما دون)</label>
            <input type="number" min={0} max={18} value={form.child_age_max}
              onChange={e => setForm({ ...form, child_age_max: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">حد سن الصغير (سنة وما دون)</label>
            <input type="number" min={0} max={30} value={form.young_age_max}
              onChange={e => setForm({ ...form, young_age_max: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">نسبة الصغير من البالغ: {Math.round(form.young_cost_multiplier * 100)}%</label>
          <input type="range" min={0} max={1} step={0.1} value={form.young_cost_multiplier}
            onChange={e => setForm({ ...form, young_cost_multiplier: parseFloat(e.target.value) })}
            className="w-full accent-primary" />
        </div>
      </div>

      {/* Rate Preview */}
      <div className="border-t border-gray-100 pt-4">
        <h3 className="font-bold text-text mb-1">معاينة الأسعار</h3>
        <p className="text-xs text-text-secondary mb-3">تقديرية — الأسعار الفعلية تُحسب بعد اختيار الحضور</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-green-50 rounded-xl border border-green-100">
            <p className="text-xs text-green-600 font-medium mb-1">المشترك - بالغ</p>
            <p className="text-lg font-black text-green-700">{fmt(subscriberRate)}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl border border-red-100">
            <p className="text-xs text-red-600 font-medium mb-1">غير المشترك - بالغ</p>
            <p className="text-lg font-black text-red-700">{fmt(nonSubscriberRate)}</p>
            {nonSubscriberRate <= subscriberRate && (
              <p className="text-xs text-red-500 mt-1">⚠️ يجب أن يكون أعلى من المشترك</p>
            )}
          </div>
          <div className="p-3 bg-green-50 rounded-xl border border-green-100">
            <p className="text-xs text-green-600 font-medium mb-1">المشترك - صغير</p>
            <p className="text-lg font-black text-green-700">{fmt(youngSubscriber)}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl border border-red-100">
            <p className="text-xs text-red-600 font-medium mb-1">غير المشترك - صغير</p>
            <p className="text-lg font-black text-red-700">{fmt(youngNonSubscriber)}</p>
          </div>
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

// ─── Family Head Selector ───
function FamilyHeadSelector({
  heads, selected, onToggle, onSelectAll, onDeselectAll, search, onSearch,
}: {
  heads: FamilyHead[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  search: string;
  onSearch: (s: string) => void;
}) {
  const filtered = heads.filter(h => h.name.includes(search));
  const subscriberSelected = [...selected].filter(id => heads.find(h => h.id === id)?.is_fund_subscriber).length;
  const nonSubscriberSelected = selected.size - subscriberSelected;

  return (
    <div className="space-y-3">
      {/* Search + actions */}
      <div className="flex gap-2">
        <input value={search} onChange={e => onSearch(e.target.value)}
          placeholder="بحث باسم رب الأسرة..."
          className="flex-1 px-3 py-2 bg-surface rounded-xl border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button onClick={onSelectAll} className="px-3 py-2 bg-primary/10 text-primary rounded-xl text-xs font-medium cursor-pointer border-none whitespace-nowrap">تحديد الكل</button>
        <button onClick={onDeselectAll} className="px-3 py-2 bg-surface text-text-secondary rounded-xl text-xs cursor-pointer border-none whitespace-nowrap">إلغاء الكل</button>
      </div>

      {/* Stats */}
      {selected.size > 0 && (
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-green-50 text-green-700 rounded-lg font-medium">{subscriberSelected} مشترك</span>
          <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg font-medium">{nonSubscriberSelected} غير مشترك</span>
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">
            {[...selected].reduce((s, id) => s + (heads.find(h => h.id === id)?.total_members || 0), 0)} فرد
          </span>
        </div>
      )}

      {/* List */}
      <div className="max-h-80 overflow-y-auto space-y-1.5 pl-1">
        {filtered.length === 0 && (
          <p className="text-center text-text-secondary text-sm py-4">لا توجد نتائج</p>
        )}
        {filtered.map(head => {
          const isSelected = selected.has(head.id);
          return (
            <label key={head.id}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${isSelected ? 'bg-primary/5 border-primary/20' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
              <input type="checkbox" checked={isSelected} onChange={() => onToggle(head.id)}
                className="w-4 h-4 accent-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text">{head.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${head.is_fund_subscriber ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {head.is_fund_subscriber ? 'مشترك' : 'غير مشترك'}
                  </span>
                </div>
                <div className="text-xs text-text-secondary mt-0.5 flex gap-2">
                  <span>{head.total_members} فرد</span>
                  {head.adult_count > 0 && <span>{head.adult_count} بالغ</span>}
                  {head.young_count > 0 && <span>{head.young_count} صغير</span>}
                  {head.child_count > 0 && <span>{head.child_count} طفل</span>}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function EventCalculatorPage() {
  const [events, setEvents] = useState<FundEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FundEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FundEvent | null>(null);
  const [familyHeads, setFamilyHeads] = useState<FamilyHead[]>([]);
  const [selectedHeads, setSelectedHeads] = useState<Set<number>>(new Set());
  const [headSearch, setHeadSearch] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

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
      const ev = res.data;
      setSelectedEvent(ev);
      // Load family heads with event's age settings
      const existingIds = ev.families && ev.families.length > 0 ? ev.families.map((f: EventFamily) => f.head_member_id).join(',') : '';
      const headsRes = await api.get(`/fund/family-heads?child_age_max=${ev.child_age_max}&young_age_max=${ev.young_age_max}${existingIds ? '&selected_ids=' + existingIds : ''}`);
      setFamilyHeads(headsRes.data);
      // Pre-select heads that already have families in this event
      if (ev.families && ev.families.length > 0) {
        setSelectedHeads(new Set(ev.families.map((f: EventFamily) => f.head_member_id)));
      } else {
        setSelectedHeads(new Set());
      }
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
      if (selectedEvent?.id === editingEvent.id) await loadEventDetail(editingEvent.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطأ في التحديث');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/fund/events/${id}`);
      setDeleteConfirm(null);
      if (selectedEvent?.id === id) { setSelectedEvent(null); setFamilyHeads([]); }
      await loadEvents();
    } catch { alert('خطأ في الحذف'); }
  };

  const handleCalculate = async () => {
    if (!selectedEvent || selectedHeads.size === 0) {
      alert('يرجى اختيار أرباب أسر أولاً');
      return;
    }
    setCalculating(true);
    try {
      await api.post(`/fund/events/${selectedEvent.id}/calculate-families`, {
        family_head_ids: [...selectedHeads],
      });
      await loadEventDetail(selectedEvent.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'خطأ في الحساب');
    }
    setCalculating(false);
  };

  const handleExportPdf = async () => {
    if (!selectedEvent) return;
    setExportingPdf(true);
    try {
      const reportRes = await api.get(`/fund/events/${selectedEvent.id}/report`);
      const { generateEventReportPdf } = await import('../services/eventReportPdf');
      await generateEventReportPdf(reportRes.data);
    } catch (err) {
      alert('خطأ في تصدير التقرير');
    }
    setExportingPdf(false);
  };

  const toggleHead = (id: number) => {
    setSelectedHeads(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleUpdateFamily = async (familyId: number, data: { adult_count?: number; young_count?: number; child_count?: number; exempt_count?: number }) => {
    if (!selectedEvent) return;
    try {
      await api.put(`/fund/events/${selectedEvent.id}/families/${familyId}`, data);
      await loadEventDetail(selectedEvent.id);
    } catch { alert('خطأ في التحديث'); }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  const ev = selectedEvent;
  const rates = ev?.rates;
  const families: EventFamily[] = ev?.families || [];
  const grandTotal = ev?.family_total_cost || 0;
  const subscriberFamilies = families.filter(f => f.is_subscriber);
  const nonSubscriberFamilies = families.filter(f => !f.is_subscriber);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-text">حاسبة تكلفة المناسبات</h1>
          <p className="text-text-secondary text-sm mt-1">اختر أرباب الأسر وأدخل التكاليف لاحتساب القسط</p>
        </div>
        {!showCreate && !editingEvent && (
          <button onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm cursor-pointer border-none flex items-center gap-2 flex-shrink-0">
            <span className="text-lg leading-none">+</span> مناسبة جديدة
          </button>
        )}
      </div>

      {/* Create / Edit Form */}
      {showCreate && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-text">إنشاء مناسبة جديدة</h2>
          </div>
          <EventFormPanel initial={defaultForm} onSave={handleCreate} onCancel={() => setShowCreate(false)} />
        </div>
      )}
      {editingEvent && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-text">تعديل: {editingEvent.name}</h2>
          </div>
          <EventFormPanel
            initial={{
              name: editingEvent.name,
              date: editingEvent.date || '',
              notes: editingEvent.notes || '',
              status: editingEvent.status,
              dinner_cost: editingEvent.dinner_cost || 0,
              venue_cost: editingEvent.venue_cost || 0,
              hospitality_cost: editingEvent.hospitality_cost || 0,
              other_cost: editingEvent.other_cost || 0,
              subscriber_exemptions: editingEvent.subscriber_exemptions || [],
              non_subscriber_surcharge: editingEvent.non_subscriber_surcharge || 0,
              child_age_max: editingEvent.child_age_max,
              young_age_max: editingEvent.young_age_max,
              young_cost_multiplier: editingEvent.young_cost_multiplier,
              child_cost_multiplier: editingEvent.child_cost_multiplier,
              exempt_non_bamuflih_spouses: !!editingEvent.exempt_non_bamuflih_spouses,
              exempt_their_children: !!editingEvent.exempt_their_children,
            }}
            onSave={handleUpdate}
            onCancel={() => setEditingEvent(null)}
          />
        </div>
      )}

      <div className={`grid gap-6 ${ev ? 'lg:grid-cols-5' : 'grid-cols-1'}`}>
        {/* Events List */}
        <div className={ev ? 'lg:col-span-2' : ''}>
          {events.length === 0 && !showCreate ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p className="text-text font-medium mb-2">لا توجد مناسبات</p>
              <p className="text-text-secondary text-sm">أنشئ مناسبة جديدة لحساب تكلفتها</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(evItem => {
                const statusMeta = statusLabels[evItem.status] || { label: evItem.status, color: 'bg-gray-100 text-gray-600' };
                const isSelected = ev?.id === evItem.id;
                const total = (evItem.dinner_cost || 0) + (evItem.venue_cost || 0) + (evItem.hospitality_cost || 0) + (evItem.other_cost || 0);
                return (
                  <div key={evItem.id}
                    className={`bg-white rounded-2xl shadow-sm border overflow-hidden cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100 hover:border-gray-200'}`}
                    onClick={() => { loadEventDetail(evItem.id); }}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-text text-sm truncate">{evItem.name}</h3>
                          {evItem.date && <p className="text-xs text-text-secondary mt-0.5">{evItem.date}</p>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium flex-shrink-0 ${statusMeta.color}`}>{statusMeta.label}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                        <span>إجمالي الفرد: {fmt(total)}</span>
                        {evItem.subscriber_exemptions && evItem.subscriber_exemptions.length > 0 && (
                          <span className="text-green-600">إعفاء مشترك</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditingEvent(evItem); setSelectedEvent(null); }}
                          className="px-3 py-1.5 bg-surface text-text-secondary rounded-lg text-xs cursor-pointer border-none hover:bg-gray-100">
                          تعديل
                        </button>
                        {deleteConfirm === evItem.id ? (
                          <>
                            <button onClick={() => handleDelete(evItem.id)}
                              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium cursor-pointer border-none">تأكيد</button>
                            <button onClick={() => setDeleteConfirm(null)}
                              className="px-3 py-1.5 bg-surface text-text-secondary rounded-lg text-xs cursor-pointer border-none">إلغاء</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirm(evItem.id)}
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

        {/* Event Detail */}
        {ev && (
          <div className="lg:col-span-3 space-y-4">
            {/* Rate Summary */}
            {rates && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <h3 className="font-bold text-text mb-1 text-sm">نصيب الفرد حسب الاشتراك</h3>
                <p className="text-xs text-text-secondary mb-3">إجمالي التكاليف ÷ عدد الحضور = نصيب الفرد</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                    <p className="text-xs text-green-600 font-semibold mb-1">✓ المشترك</p>
                    <p className="text-sm font-black text-green-700">بالغ: {fmt(rates.subscriber_adult)}</p>
                    {rates.subscriber_young > 0 && <p className="text-xs text-green-600 mt-0.5">صغير: {fmt(rates.subscriber_young)}</p>}
                    {(ev.subscriber_exemptions?.length || 0) > 0 && (
                      <p className="text-xs text-green-500 mt-1">
                        إعفاء: {ev.subscriber_exemptions!.map(k => costItemLabels[k]).join('، ')}
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <p className="text-xs text-orange-600 font-semibold mb-1">✗ غير المشترك</p>
                    <p className="text-sm font-black text-orange-700">بالغ: {fmt(rates.non_subscriber_adult)}</p>
                    {rates.non_subscriber_young > 0 && <p className="text-xs text-orange-600 mt-0.5">صغير: {fmt(rates.non_subscriber_young)}</p>}
                    {(ev.non_subscriber_surcharge || 0) > 0 && (
                      <p className="text-xs text-orange-500 mt-1">رسوم إضافية: {fmt(ev.non_subscriber_surcharge || 0)}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Family Head Selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h3 className="font-bold text-text mb-3 text-sm">اختيار أرباب الأسر الحاضرين</h3>
              <FamilyHeadSelector
                heads={familyHeads}
                selected={selectedHeads}
                onToggle={toggleHead}
                onSelectAll={() => setSelectedHeads(new Set(familyHeads.map(h => h.id)))}
                onDeselectAll={() => setSelectedHeads(new Set())}
                search={headSearch}
                onSearch={setHeadSearch}
              />
              <button onClick={handleCalculate} disabled={calculating || selectedHeads.size === 0}
                className="mt-3 w-full py-2.5 bg-primary text-white rounded-xl font-medium text-sm cursor-pointer border-none hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {calculating ? 'جاري الحساب...' : `احسب تكلفة ${selectedHeads.size} عائلة`}
              </button>
            </div>

            {/* Results */}
            {families.length > 0 && (
              <>
                {/* Grand Total */}
                <div className="bg-primary rounded-2xl p-4 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-80 mb-1">إجمالي التكلفة</p>
                      <p className="text-3xl font-black">{fmt(grandTotal)}</p>
                      <p className="text-sm opacity-70 mt-1">{families.length} عائلة — {families.reduce((s, f) => s + f.adult_count + f.young_count + f.child_count, 0)} فرد</p>
                    </div>
                    <button onClick={handleExportPdf} disabled={exportingPdf}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-medium cursor-pointer border border-white/30 transition-colors disabled:opacity-50">
                      {exportingPdf ? '...' : 'تصدير PDF'}
                    </button>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
                    <p className="text-xs text-text-secondary mb-1">إجمالي العائلات</p>
                    <p className="text-2xl font-black text-text">{families.length}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 border border-green-100 text-center">
                    <p className="text-xs text-green-600 mb-1">مشتركون</p>
                    <p className="text-2xl font-black text-green-700">{subscriberFamilies.length}</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 text-center">
                    <p className="text-xs text-orange-600 mb-1">غير مشتركين</p>
                    <p className="text-2xl font-black text-orange-700">{nonSubscriberFamilies.length}</p>
                  </div>
                </div>

                {/* Families Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-text text-sm">تفصيل العائلات</h3>
                    <span className="text-xs text-text-secondary">{families.length} عائلة — يمكنك تعديل الأعداد يدوياً</span>
                  </div>
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="bg-surface/50 border-b border-gray-100">
                          <th className="px-2 py-3 text-start text-text-secondary font-medium text-xs">رب الأسرة</th>
                          <th className="px-2 py-3 text-center text-text-secondary font-medium text-xs">اشتراك</th>
                          <th className="px-2 py-3 text-center text-text-secondary font-medium text-xs w-16">بالغ</th>
                          <th className="px-2 py-3 text-center text-text-secondary font-medium text-xs w-16">صغير</th>
                          <th className="px-2 py-3 text-center text-text-secondary font-medium text-xs w-16">طفل</th>
                          <th className="px-2 py-3 text-center text-text-secondary font-medium text-xs w-16">معفيون</th>
                          <th className="px-2 py-3 text-start text-text-secondary font-medium text-xs">المطلوب</th>
                        </tr>
                      </thead>
                      <tbody>
                        {families.map((f, i) => {
                          const totalMembers = f.adult_count + f.young_count + f.child_count;
                          return (
                          <tr key={i} className={`border-b border-gray-50 hover:bg-surface/30 ${(f.exempt_count || 0) >= totalMembers ? 'bg-purple-50/40' : f.is_subscriber ? '' : 'bg-orange-50/30'}`}>
                            <td className="px-2 py-2 font-medium text-sm">{f.head_name}</td>
                            <td className="px-2 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${f.is_subscriber ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {f.is_subscriber ? 'مشترك' : 'غير مشترك'}
                              </span>
                            </td>
                            <td className="px-1 py-2 text-center">
                              <input type="number" min={0} value={f.adult_count}
                                onChange={e => f.id && handleUpdateFamily(f.id, { adult_count: parseInt(e.target.value) || 0 })}
                                className="w-14 px-1 py-1 bg-surface rounded-lg border-none text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <input type="number" min={0} value={f.young_count}
                                onChange={e => f.id && handleUpdateFamily(f.id, { young_count: parseInt(e.target.value) || 0 })}
                                className="w-14 px-1 py-1 bg-surface rounded-lg border-none text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <input type="number" min={0} value={f.child_count}
                                onChange={e => f.id && handleUpdateFamily(f.id, { child_count: parseInt(e.target.value) || 0 })}
                                className="w-14 px-1 py-1 bg-surface rounded-lg border-none text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <input type="number" min={0} max={totalMembers} value={f.exempt_count || 0}
                                onChange={e => f.id && handleUpdateFamily(f.id, { exempt_count: parseInt(e.target.value) || 0 })}
                                className={`w-14 px-1 py-1 rounded-lg border-none text-center text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 ${(f.exempt_count || 0) > 0 ? 'bg-purple-100 text-purple-700 font-bold' : 'bg-surface'}`} />
                            </td>
                            <td className="px-2 py-2 font-bold text-sm">
                              {(f.exempt_count || 0) >= totalMembers
                                ? <span className="text-purple-500">معفى بالكامل</span>
                                : <span className="text-primary">{fmt(f.total_cost)}</span>
                              }
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="sticky bottom-0 bg-white border-t-2 border-gray-200">
                        <tr>
                          <td className="px-2 py-3 font-black text-sm" colSpan={6}>الإجمالي</td>
                          <td className="px-2 py-3 font-black text-primary text-sm">{fmt(grandTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}

            {families.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-text-secondary text-sm">
                اختر أرباب الأسر من القائمة أعلاه ثم اضغط "احسب"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
