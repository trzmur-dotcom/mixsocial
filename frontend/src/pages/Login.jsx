import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  const { t, toggle, lang } = useLang();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setField = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.username, form.email, form.password);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center px-6">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[380px] relative fade-in">
        {/* Lang toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={toggle}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
          >
            🌐
          </button>
        </div>

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">🍹</div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
            MixSocial
          </h1>
          <p className="text-white/40 text-sm mt-1">{t('tagline')}</p>
        </div>

        {/* Tabs */}
        <div className="flex glass rounded-2xl p-1 mb-6">
          {['login', 'register'].map(tabKey => (
            <button
              key={tabKey}
              onClick={() => { setTab(tabKey); setError(''); setForm({ username: '', email: '', password: '' }); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === tabKey
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tabKey === 'login' ? t('signIn') : t('createAccount')}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === 'register' && (
            <input
              type="text"
              placeholder={t('username')}
              value={form.username}
              onChange={setField('username')}
              required
              minLength={3}
              maxLength={30}
              autoComplete="username"
            />
          )}
          <input
            type="email"
            placeholder={t('email')}
            value={form.email}
            onChange={setField('email')}
            required
            autoComplete="email"
          />
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              placeholder={t('password')}
              value={form.password}
              onChange={setField('password')}
              required
              minLength={6}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              style={{ paddingRight: '3rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base mt-2"
            style={{ borderRadius: '12px' }}
          >
            {loading
              ? '...'
              : tab === 'login'
                ? t('signIn')
                : t('createAccount')}
          </button>
        </form>

        {/* Separator */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <span className="text-white/25 text-xs">{lang === 'he' ? 'מאובטח ופרטי' : 'secure & private'}</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Trust badges */}
        <div className="flex justify-center gap-4 text-white/20 text-[10px] text-center">
          <span>🔒 {lang === 'he' ? 'סיסמה מוצפנת' : 'Encrypted password'}</span>
          <span>🔑 {lang === 'he' ? 'מחובר 30 יום' : 'Stay logged in 30 days'}</span>
          <span>🚫 {lang === 'he' ? 'ללא ספאם' : 'No spam'}</span>
        </div>
      </div>
    </div>
  );
}
