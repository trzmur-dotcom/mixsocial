import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { Eye, EyeOff } from 'lucide-react';
import api from '../api';

export default function Login() {
  const { login, register } = useAuth();
  const { t, toggle, lang } = useLang();

  // 'login' | 'register' | 'forgot' | 'reset' | 'done'
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset-password state
  const [resetToken, setResetToken] = useState('');   // returned by /forgot-password
  const [resetExpires, setResetExpires] = useState(0); // minutes left
  const [resetEmail, setResetEmail] = useState('');
  const [newPass, setNewPass] = useState('');

  const setField = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const goTo = (next) => { setTab(next); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
      } else if (tab === 'register') {
        await register(form.username, form.email, form.password);
      } else if (tab === 'forgot') {
        // Always show the reset card — even if email doesn't exist (anti-enumeration)
        const { data } = await api.post('/auth/forgot-password', { email: form.email });
        setResetEmail(form.email);
        if (data.token) {
          setResetToken(data.token);
          setResetExpires(data.expiresInMinutes || 30);
        } else {
          setResetToken(''); // no account, but UI looks the same
        }
        goTo('reset');
      } else if (tab === 'reset') {
        if (!resetToken) {
          setError(lang === 'he' ? 'אימייל לא נמצא במערכת' : 'No account found for that email');
          setLoading(false);
          return;
        }
        if (newPass.length < 8) {
          setError(lang === 'he' ? 'סיסמה חייבת לפחות 8 תווים' : 'Password must be at least 8 characters');
          setLoading(false);
          return;
        }
        await api.post('/auth/reset-password', { token: resetToken, password: newPass });
        setResetToken('');
        setNewPass('');
        goTo('done');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center px-6">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[380px] relative fade-in">
        {/* Lang toggle */}
        <div className="flex justify-end mb-4">
          <button onClick={toggle}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
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

        {/* Login / Register tabs (only on those tabs) */}
        {(tab === 'login' || tab === 'register') && (
          <div className="flex glass rounded-2xl p-1 mb-6">
            {['login', 'register'].map(tabKey => (
              <button
                key={tabKey}
                onClick={() => { goTo(tabKey); setForm({ username: '', email: '', password: '' }); }}
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
        )}

        {/* Heading for non-tabbed states */}
        {tab === 'forgot' && (
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-white mb-1">{t('resetPassword')}</h2>
            <p className="text-white/40 text-sm">{t('enterEmailToReset')}</p>
          </div>
        )}
        {tab === 'reset' && (
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-white mb-1">{t('setNewPassword')}</h2>
            <p className="text-white/40 text-sm">{t('resetLinkReady')}</p>
            {resetToken > '' && resetExpires > 0 && (
              <p className="text-white/30 text-xs mt-2">{t('expiresIn')} {resetExpires} {t('minutes')}</p>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === 'register' && (
            <>
              <input type="text" placeholder={t('username')}
                value={form.username} onChange={setField('username')}
                required minLength={3} maxLength={30}
                autoComplete="off" autoCapitalize="off" spellCheck="false"
                name="display-name" />
              <p className="text-white/30 text-[11px] -mt-1 px-2">
                {lang === 'he'
                  ? 'אותיות, מספרים, רווחים וקו תחתון. ללא @ או נקודה.'
                  : 'Letters, numbers, spaces or underscore. No @ or dots.'}
              </p>
            </>
          )}

          {(tab === 'login' || tab === 'register' || tab === 'forgot') && (
            <input type="email" placeholder={t('email')}
              value={form.email} onChange={setField('email')}
              required autoComplete="email" />
          )}

          {(tab === 'login' || tab === 'register') && (
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} placeholder={t('password')}
                value={form.password} onChange={setField('password')}
                required minLength={8} maxLength={128}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                style={{ paddingRight: '3rem' }} />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          {tab === 'reset' && (
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} placeholder={t('newPassword')}
                value={newPass} onChange={(e) => setNewPass(e.target.value)}
                required minLength={8} maxLength={128} autoComplete="new-password"
                style={{ paddingRight: '3rem' }} />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          {tab === 'done' && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-4 text-emerald-400 text-sm text-center">
              ✅ {t('resetSuccess')}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {tab !== 'done' && (
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 text-base mt-2"
              style={{ borderRadius: '12px' }}>
              {loading ? '...'
                : tab === 'login'      ? t('signIn')
                : tab === 'register'   ? t('createAccount')
                : tab === 'forgot'     ? t('sendResetLink')
                : t('confirmReset')}
            </button>
          )}

          {tab === 'done' && (
            <button type="button" onClick={() => goTo('login')}
              className="btn-primary w-full py-3 text-base mt-2"
              style={{ borderRadius: '12px' }}>
              {t('signIn')}
            </button>
          )}
        </form>

        {/* Forgot password link */}
        {tab === 'login' && (
          <div className="text-center mt-3">
            <button type="button" onClick={() => goTo('forgot')}
              className="text-xs text-white/40 hover:text-purple-400 transition-colors">
              {t('forgotPassword')}
            </button>
          </div>
        )}

        {/* Back-to-login link */}
        {(tab === 'forgot' || tab === 'reset' || tab === 'done') && tab !== 'done' && (
          <div className="text-center mt-3">
            <button type="button" onClick={() => goTo('login')}
              className="text-xs text-white/40 hover:text-purple-400 transition-colors">
              {t('backToLogin')}
            </button>
          </div>
        )}

        {/* Separator + trust badges (only on auth tabs) */}
        {(tab === 'login' || tab === 'register') && (
          <>
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-white/25 text-xs">{lang === 'he' ? 'מאובטח ופרטי' : 'secure & private'}</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>
            <div className="flex justify-center gap-4 text-white/20 text-[10px] text-center">
              <span>🔒 {lang === 'he' ? 'סיסמה מוצפנת' : 'Encrypted password'}</span>
              <span>🔑 {lang === 'he' ? 'מחובר 30 יום' : 'Stay logged in 30 days'}</span>
              <span>🚫 {lang === 'he' ? 'ללא ספאם' : 'No spam'}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
