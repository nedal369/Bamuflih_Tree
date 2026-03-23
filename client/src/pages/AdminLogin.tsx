import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, register } from '../services/api';

export default function AdminLogin() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      setAuth(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطأ في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await register(username, password, fullName);
      setSuccess(data.message);
      setMode('login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'خطأ في إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-text">عائلة آل بامفلح</h1>
          <p className="text-text-secondary text-sm mt-1">بوابة العائلة الخاصة</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white p-1 rounded-xl mb-4 shadow-sm">
          <button
            onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border-none ${
              mode === 'login' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text bg-transparent'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border-none ${
              mode === 'register' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text bg-transparent'
            }`}
          >
            حساب جديد
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {error && (
            <div className="bg-danger/10 text-danger text-sm font-medium px-4 py-3 rounded-xl mb-4">{error}</div>
          )}
          {success && (
            <div className="bg-success/10 text-success text-sm font-medium px-4 py-3 rounded-xl mb-4">{success}</div>
          )}

          {mode === 'register' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-text mb-2">الاسم الكامل</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                placeholder="مثال: نضال عبدالله بامفلح"
                required
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-text mb-2">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-text mb-2">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-surface rounded-xl border-none text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-dark transition-colors cursor-pointer border-none disabled:opacity-50"
          >
            {loading ? 'جاري...' : (mode === 'login' ? 'دخول' : 'إنشاء حساب')}
          </button>

          {mode === 'register' && (
            <p className="text-xs text-text-secondary text-center mt-4">
              بعد إنشاء الحساب، سيتم مراجعته من قبل الإدارة للموافقة عليه
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
