import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface FundSummary {
  balance: number;
  total_income: number;
  total_expense: number;
  subscription_total: number;
  active_loans_count: number;
  active_loans_outstanding: number;
  pending_loans_count: number;
}

interface FundTransaction {
  id: number;
  type: string;
  amount: number;
  member_name?: string;
  description?: string;
  date?: string;
  created_by_username?: string;
  created_at: string;
}

interface FundLoan {
  id: number;
  member_id: number;
  member_name: string;
  amount: number;
  purpose?: string;
  status: string;
  requested_date?: string;
  approved_date?: string;
  due_date?: string;
  amount_repaid: number;
  notes?: string;
}

interface MemberStatus {
  id: number;
  name: string;
  generation: number;
  gender: string;
  paid_amount?: number;
  paid_date?: string;
}

const typeLabels: Record<string, { label: string; color: string; sign: string }> = {
  subscription: { label: 'اشتراك', color: 'bg-green-100 text-green-800', sign: '+' },
  donation: { label: 'تبرع', color: 'bg-emerald-100 text-emerald-800', sign: '+' },
  zakat: { label: 'زكاة', color: 'bg-teal-100 text-teal-800', sign: '+' },
  loan_repayment: { label: 'سداد قرض', color: 'bg-blue-100 text-blue-800', sign: '+' },
  other_income: { label: 'إيراد آخر', color: 'bg-cyan-100 text-cyan-800', sign: '+' },
  loan_given: { label: 'قرض ممنوح', color: 'bg-orange-100 text-orange-800', sign: '-' },
  support: { label: 'دعم', color: 'bg-red-100 text-red-800', sign: '-' },
  event_expense: { label: 'مناسبة', color: 'bg-purple-100 text-purple-800', sign: '-' },
  other_expense: { label: 'مصروف آخر', color: 'bg-gray-100 text-gray-800', sign: '-' },
};

const loanStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'موافق عليه', color: 'bg-blue-100 text-blue-800' },
  active: { label: 'نشط', color: 'bg-green-100 text-green-800' },
  repaid: { label: 'مسدد', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'ملغى', color: 'bg-red-100 text-red-700' },
};

const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function formatAmount(n: number) {
  return n.toLocaleString('ar-SA') + ' ر.س';
}

export default function FundPage() {
  const { isAdmin } = useAuth();
  const [summary, setSummary] = useState<FundSummary | null>(null);
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [loans, setLoans] = useState<FundLoan[]>([]);
  const [membersStatus, setMembersStatus] = useState<MemberStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'loans' | 'subscriptions'>('overview');

  const now = new Date();
  const [statusYear, setStatusYear] = useState(now.getFullYear());
  const [statusMonth, setStatusMonth] = useState(now.getMonth() + 1);

  // Add transaction form
  const [showAddTx, setShowAddTx] = useState(false);
  const [txForm, setTxForm] = useState({ type: 'subscription', amount: '', member_id: '', description: '', date: now.toISOString().split('T')[0] });
  const [txLoading, setTxLoading] = useState(false);

  // Add subscription form
  const [showAddSub, setShowAddSub] = useState(false);
  const [subForm, setSubForm] = useState({ member_id: '', year: statusYear, month: statusMonth, amount: '100', paid_date: now.toISOString().split('T')[0] });
  const [subLoading, setSubLoading] = useState(false);

  // Loan management
  const [updatingLoan, setUpdatingLoan] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, txRes, loanRes] = await Promise.all([
        api.get('/fund/summary'),
        api.get('/fund/transactions?limit=100'),
        api.get('/fund/loans'),
      ]);
      setSummary(sumRes.data);
      setTransactions(txRes.data.transactions);
      setLoans(loanRes.data);
    } catch { }
    setLoading(false);
  }, []);

  const loadMembersStatus = useCallback(async () => {
    try {
      const res = await api.get(`/fund/members-status?year=${statusYear}&month=${statusMonth}`);
      setMembersStatus(res.data.members);
    } catch { }
  }, [statusYear, statusMonth]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadMembersStatus(); }, [loadMembersStatus]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxLoading(true);
    try {
      await api.post('/fund/transactions', { ...txForm, amount: parseFloat(txForm.amount) });
      setShowAddTx(false);
      setTxForm({ type: 'subscription', amount: '', member_id: '', description: '', date: now.toISOString().split('T')[0] });
      await loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error || 'حدث خطأ');
    }
    setTxLoading(false);
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubLoading(true);
    try {
      await api.post('/fund/subscriptions', { ...subForm, amount: parseFloat(subForm.amount) });
      setShowAddSub(false);
      await loadAll();
      await loadMembersStatus();
    } catch (err: any) {
      alert(err.response?.data?.error || 'حدث خطأ');
    }
    setSubLoading(false);
  };

  const handleUpdateLoan = async (id: number, status: string) => {
    setUpdatingLoan(id);
    try {
      await api.put(`/fund/loans/${id}`, {
        status,
        approved_date: status === 'approved' ? now.toISOString().split('T')[0] : undefined,
      });
      await loadAll();
    } catch (err: any) {
      alert(err.response?.data?.error || 'حدث خطأ');
    }
    setUpdatingLoan(null);
  };

  if (loading) return <LoadingSpinner size="lg" />;

  const paidCount = membersStatus.filter(m => m.paid_amount).length;
  const notPaidCount = membersStatus.filter(m => !m.paid_amount).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-text">صندوق صالح بامفلح العائلي</h1>
        <p className="text-text-secondary text-sm mt-1">إدارة موارد الصندوق العائلي، القروض الحسنة، والاشتراكات</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-text-secondary mb-1">الرصيد الحالي</p>
            <p className={`text-lg font-black ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatAmount(summary.balance)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-text-secondary mb-1">إجمالي الإيرادات</p>
            <p className="text-lg font-black text-text">{formatAmount(summary.total_income)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-text-secondary mb-1">القروض النشطة</p>
            <p className="text-lg font-black text-orange-600">{summary.active_loans_count}</p>
            <p className="text-xs text-text-secondary">{formatAmount(summary.active_loans_outstanding)} مستحق</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-text-secondary mb-1">طلبات معلقة</p>
            <p className="text-lg font-black text-yellow-600">{summary.pending_loans_count}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {([
          { id: 'overview', label: 'نظرة عامة' },
          { id: 'subscriptions', label: 'الاشتراكات' },
          { id: 'transactions', label: 'المعاملات' },
          { id: 'loans', label: 'القروض' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap cursor-pointer border-none transition-colors ${activeTab === t.id ? 'bg-primary text-white' : 'bg-white text-text-secondary hover:bg-surface'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-text mb-4">عن الصندوق</h3>
            <div className="space-y-3 text-sm text-text-secondary">
              <p>صندوق صالح بامفلح العائلي هو كيان مؤسسي شامل يدير شؤون الأسرة المالية والاجتماعية.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="font-semibold text-green-800 text-xs mb-1">مصادر الإيراد</p>
                  <ul className="text-xs text-green-700 space-y-0.5">
                    <li>رسوم التسجيل والاشتراكات الشهرية</li>
                    <li>التبرعات والهبات</li>
                    <li>الزكاة وعوائد الاستثمار</li>
                  </ul>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="font-semibold text-blue-800 text-xs mb-1">أوجه الصرف</p>
                  <ul className="text-xs text-blue-700 space-y-0.5">
                    <li>دعم المحتاجين من الأسرة</li>
                    <li>القروض الحسنة</li>
                    <li>المناسبات والتعليم والصحة</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Recent transactions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-text">آخر المعاملات</h3>
              <button onClick={() => setActiveTab('transactions')} className="text-xs text-primary cursor-pointer border-none bg-transparent">عرض الكل</button>
            </div>
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-sm">لا توجد معاملات مسجلة</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {transactions.slice(0, 5).map(tx => {
                  const meta = typeLabels[tx.type] || { label: tx.type, color: 'bg-gray-100 text-gray-700', sign: '' };
                  return (
                    <div key={tx.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${meta.color}`}>{meta.label}</span>
                          {tx.member_name && <span className="text-xs text-text-secondary">{tx.member_name}</span>}
                        </div>
                        {tx.description && <p className="text-xs text-text-secondary truncate">{tx.description}</p>}
                      </div>
                      <span className={`font-bold text-sm ${meta.sign === '+' ? 'text-green-600' : 'text-red-500'}`}>
                        {meta.sign}{formatAmount(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select value={statusYear} onChange={e => setStatusYear(parseInt(e.target.value))}
              className="px-3 py-2 bg-white rounded-xl border-none text-sm shadow-sm">
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select value={statusMonth} onChange={e => setStatusMonth(parseInt(e.target.value))}
              className="px-3 py-2 bg-white rounded-xl border-none text-sm shadow-sm">
              {monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-lg font-medium">دفع: {paidCount}</span>
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg font-medium">لم يدفع: {notPaidCount}</span>
            </div>
            {isAdmin && (
              <button onClick={() => setShowAddSub(true)}
                className="mr-auto px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium cursor-pointer border-none">
                + تسجيل دفع
              </button>
            )}
          </div>

          {showAddSub && isAdmin && (
            <form onSubmit={handleAddSubscription} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h3 className="font-bold text-text">تسجيل دفع اشتراك</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text mb-1">معرف العضو</label>
                  <input type="number" value={subForm.member_id} onChange={e => setSubForm({ ...subForm, member_id: e.target.value })}
                    required className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm" placeholder="ID العضو" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">المبلغ (ر.س)</label>
                  <input type="number" value={subForm.amount} onChange={e => setSubForm({ ...subForm, amount: e.target.value })}
                    required className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">السنة</label>
                  <input type="number" value={subForm.year} onChange={e => setSubForm({ ...subForm, year: parseInt(e.target.value) })}
                    required className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">الشهر</label>
                  <select value={subForm.month} onChange={e => setSubForm({ ...subForm, month: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm">
                    {monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">تاريخ الدفع</label>
                  <input type="date" value={subForm.paid_date} onChange={e => setSubForm({ ...subForm, paid_date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={subLoading}
                  className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium cursor-pointer border-none disabled:opacity-50">
                  {subLoading ? 'جاري...' : 'تسجيل'}
                </button>
                <button type="button" onClick={() => setShowAddSub(false)}
                  className="px-5 py-2.5 bg-surface text-text rounded-xl text-sm font-medium cursor-pointer border-none">
                  إلغاء
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface/50 border-b border-gray-100">
                    <th className="px-4 py-3 text-start text-text-secondary font-medium text-xs">الاسم</th>
                    <th className="px-4 py-3 text-start text-text-secondary font-medium text-xs">الجيل</th>
                    <th className="px-4 py-3 text-center text-text-secondary font-medium text-xs">الحالة</th>
                    <th className="px-4 py-3 text-start text-text-secondary font-medium text-xs">المبلغ</th>
                    <th className="px-4 py-3 text-start text-text-secondary font-medium text-xs">تاريخ الدفع</th>
                  </tr>
                </thead>
                <tbody>
                  {membersStatus.map(m => (
                    <tr key={m.id} className={`border-b border-gray-50 ${m.paid_amount ? '' : 'bg-red-50/30'}`}>
                      <td className="px-4 py-2.5 font-medium">{m.name}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{m.generation}</td>
                      <td className="px-4 py-2.5 text-center">
                        {m.paid_amount
                          ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">دفع</span>
                          : <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium">لم يدفع</span>}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">{m.paid_amount ? formatAmount(m.paid_amount) : '—'}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{m.paid_date || '—'}</td>
                    </tr>
                  ))}
                  {membersStatus.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-text-secondary">لا توجد بيانات</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <button onClick={() => setShowAddTx(!showAddTx)}
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium cursor-pointer border-none flex items-center gap-2">
                <span className="text-lg leading-none">+</span> إضافة معاملة
              </button>
            </div>
          )}

          {showAddTx && isAdmin && (
            <form onSubmit={handleAddTransaction} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h3 className="font-bold text-text">معاملة جديدة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text mb-1">النوع</label>
                  <select value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })}
                    className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm">
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">المبلغ (ر.س)</label>
                  <input type="number" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                    required placeholder="0" className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">معرف العضو (اختياري)</label>
                  <input type="number" value={txForm.member_id} onChange={e => setTxForm({ ...txForm, member_id: e.target.value })}
                    placeholder="ID العضو" className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-1">التاريخ</label>
                  <input type="date" value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-text mb-1">ملاحظات</label>
                  <input type="text" value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })}
                    placeholder="وصف المعاملة" className="w-full px-3 py-2.5 bg-surface rounded-xl border-none text-sm" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={txLoading}
                  className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium cursor-pointer border-none disabled:opacity-50">
                  {txLoading ? 'جاري...' : 'حفظ'}
                </button>
                <button type="button" onClick={() => setShowAddTx(false)}
                  className="px-5 py-2.5 bg-surface text-text rounded-xl text-sm font-medium cursor-pointer border-none">
                  إلغاء
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">لا توجد معاملات مسجلة</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {transactions.map(tx => {
                  const meta = typeLabels[tx.type] || { label: tx.type, color: 'bg-gray-100 text-gray-700', sign: '' };
                  return (
                    <div key={tx.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${meta.color}`}>{meta.label}</span>
                          {tx.member_name && <span className="text-sm font-medium text-text">{tx.member_name}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-secondary">
                          {tx.description && <span>{tx.description}</span>}
                          <span>{tx.date || new Date(tx.created_at).toLocaleDateString('ar-SA')}</span>
                          {tx.created_by_username && <span>بواسطة: {tx.created_by_username}</span>}
                        </div>
                      </div>
                      <span className={`font-bold text-sm whitespace-nowrap ${meta.sign === '+' ? 'text-green-600' : 'text-red-500'}`}>
                        {meta.sign}{formatAmount(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loans Tab */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          {loans.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-text-secondary">
              لا توجد قروض مسجلة
            </div>
          ) : (
            <div className="space-y-3">
              {loans.map(loan => {
                const statusMeta = loanStatusLabels[loan.status] || { label: loan.status, color: 'bg-gray-100 text-gray-700' };
                const remaining = loan.amount - loan.amount_repaid;
                return (
                  <div key={loan.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-text">{loan.member_name}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${statusMeta.color}`}>{statusMeta.label}</span>
                        </div>
                        <p className="text-sm font-bold text-text">{formatAmount(loan.amount)}</p>
                        {loan.purpose && <p className="text-xs text-text-secondary mt-0.5">{loan.purpose}</p>}
                        {loan.status === 'active' && remaining > 0 && (
                          <p className="text-xs text-orange-600 mt-1">المتبقي: {formatAmount(remaining)}</p>
                        )}
                        <div className="flex gap-3 text-xs text-text-secondary mt-1">
                          {loan.requested_date && <span>طلب: {loan.requested_date}</span>}
                          {loan.due_date && <span>استحقاق: {loan.due_date}</span>}
                        </div>
                      </div>
                      {isAdmin && loan.status === 'pending' && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleUpdateLoan(loan.id, 'approved')}
                            disabled={updatingLoan === loan.id}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium cursor-pointer border-none disabled:opacity-50">
                            موافقة
                          </button>
                          <button
                            onClick={() => handleUpdateLoan(loan.id, 'cancelled')}
                            disabled={updatingLoan === loan.id}
                            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium cursor-pointer border-none disabled:opacity-50">
                            رفض
                          </button>
                        </div>
                      )}
                      {isAdmin && loan.status === 'active' && (
                        <button
                          onClick={() => handleUpdateLoan(loan.id, 'repaid')}
                          disabled={updatingLoan === loan.id}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium cursor-pointer border-none disabled:opacity-50 flex-shrink-0">
                          تم السداد
                        </button>
                      )}
                    </div>
                    {loan.notes && <p className="text-xs text-text-secondary mt-2 pt-2 border-t border-gray-50">{loan.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
