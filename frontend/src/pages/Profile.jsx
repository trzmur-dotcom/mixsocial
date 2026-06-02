import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, LogOut, ChevronLeft, Wine, Camera } from 'lucide-react';
import Avatar from '../components/Avatar';
import RecipeCard from '../components/RecipeCard';
import MyBar from '../components/MyBar';
import StoryViewer from '../components/StoryViewer';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { getAlcohol, getAlcoholLabel, ALCOHOL_TYPES } from '../utils';
import api from '../api';

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: me, logout, updateUser } = useAuth();
  const { t, lang } = useLang();
  const isMe = parseInt(id) === me?.id;

  const [profile, setProfile] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [alcoholFilter, setAlcoholFilter] = useState('all');
  const [showMyBar, setShowMyBar] = useState(false);
  const [activeStory, setActiveStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editBio, setEditBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [usernameText, setUsernameText] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const loadData = async () => {
    try {
      const [profRes, recRes] = await Promise.all([
        api.get(`/users/${id}`),
        api.get(`/users/${id}/recipes`),
      ]);
      setProfile(profRes.data);
      setRecipes(recRes.data);
      setBioText(profRes.data.bio || '');
      setUsernameText(profRes.data.username || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleFollow = async () => {
    if (profile.is_following) {
      await api.delete(`/users/${id}/follow`);
      setProfile(p => ({ ...p, is_following: false, followers_count: p.followers_count - 1 }));
    } else {
      await api.post(`/users/${id}/follow`);
      setProfile(p => ({ ...p, is_following: true, followers_count: p.followers_count + 1 }));
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    const res = await api.put('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    updateUser({ ...me, avatar: res.data.avatar });
    setProfile(p => ({ ...p, avatar: res.data.avatar }));
  };

  const handleSaveBio = async () => {
    setUsernameError('');
    const trimmedUsername = usernameText.trim();
    if (!/^[\p{L}\p{N}_ ]{3,30}$/u.test(trimmedUsername)) {
      setUsernameError(lang === 'he' ? 'שם משתמש: 3-30 תווים' : 'Username: 3–30 characters');
      return;
    }
    try {
      const updated = await api.put('/users/me/profile', { bio: bioText, username: trimmedUsername });
      updateUser(updated.data);
      setProfile(p => ({ ...p, bio: bioText, username: trimmedUsername }));
      setEditBio(false);
    } catch (err) {
      const msg = err.response?.data?.error || (lang === 'he' ? 'שגיאה בשמירה' : 'Failed to save');
      setUsernameError(msg);
    }
  };

  const filteredRecipes = () => {
    let r = recipes;
    if (alcoholFilter !== 'all') {
      r = r.filter(rec => rec.alcohol_types.includes(alcoholFilter));
    }
    return r;
  };

  const alcoholTypes = ['all', ...Array.from(new Set(recipes.flatMap(r => r.alcohol_types)))];

  const openRecipe = (recipe) => {
    setActiveStory({
      user_id: recipe.user_id,
      username: recipe.username,
      stories: [recipe],
      has_unviewed: false,
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-4xl animate-bounce">🍹</div>
    </div>
  );

  return (
    <div className="page">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
           style={{ background: 'rgba(8,8,16,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {!isMe ? (
          <button onClick={() => navigate(-1)} className="text-white/60 hover:text-white">
            <ChevronLeft size={24} />
          </button>
        ) : (
          <div className="w-8" />
        )}
        <h2 className="font-bold text-white">{profile?.username}</h2>
        {isMe ? (
          <button onClick={logout} className="text-white/40 hover:text-red-400">
            <LogOut size={20} />
          </button>
        ) : <div className="w-8" />}
      </div>

      {/* Profile card */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-4 mb-4">
          <div className="relative flex-shrink-0">
            <Avatar user={profile} size={76} />
            {isMe && (
              <label className="absolute bottom-0 right-0 cursor-pointer"
                     style={{ background: '#8b5cf6', borderRadius: '50%', width: 24, height: 24,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: '2px solid #080810' }}>
                <Camera size={12} color="white" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            )}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-xl text-white">{profile?.username}</h2>
            {editBio ? (
              <div className="mt-1 space-y-2">
                <div>
                  <input
                    value={usernameText}
                    onChange={e => { setUsernameText(e.target.value); setUsernameError(''); }}
                    placeholder={lang === 'he' ? 'שם משתמש' : 'Username'}
                    maxLength={30}
                    style={{ fontSize: '0.85rem', width: '100%' }}
                  />
                  {usernameError && <p className="text-red-400 text-[10px] mt-0.5">{usernameError}</p>}
                </div>
                <textarea value={bioText} onChange={e => setBioText(e.target.value)}
                          rows={2} maxLength={500} style={{ resize: 'none', fontSize: '0.85rem', width: '100%' }}
                          placeholder={lang === 'he' ? 'ביו...' : 'Bio...'} />
                <div className="flex gap-2 mt-1">
                  <button onClick={handleSaveBio} className="text-xs text-purple-400 font-semibold">{t('save')}</button>
                  <button onClick={() => { setEditBio(false); setUsernameError(''); }} className="text-xs text-white/30">{t('cancel')}</button>
                </div>
              </div>
            ) : (
              <>
                {profile?.bio && <p className="text-white/60 text-sm mt-1">{profile.bio}</p>}
                {isMe && (
                  <button onClick={() => { setEditBio(true); setUsernameText(profile?.username || ''); }} className="text-xs text-purple-400 mt-1 hover:text-purple-300">
                    {profile?.bio ? t('editBio') : t('addBio')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-0 mb-4 rounded-2xl overflow-hidden"
             style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            { label: lang === 'he' ? 'סטוריז' : 'Stories', value: profile?.stories_count || 0 },
            { label: t('followers'), value: profile?.followers_count || 0 },
            { label: t('following'), value: profile?.following_count || 0 },
            { label: t('savedRecipesCount'), value: recipes.length },
          ].map((stat, i, arr) => (
            <div key={i} className="flex-1 flex flex-col items-center py-3"
                 style={{ borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span className="text-lg font-bold text-white">{stat.value}</span>
              <span className="text-[10px] text-white/40 mt-0.5 text-center">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        {isMe ? (
          <button
            onClick={() => setShowMyBar(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-sm transition-all"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}
          >
            <Wine size={16} /> {t('manageMyBar')}
          </button>
        ) : (
          <button
            onClick={handleFollow}
            className={profile?.is_following ? 'w-full py-2.5 rounded-2xl font-semibold text-sm' : 'btn-primary w-full py-2.5'}
            style={profile?.is_following
              ? { borderRadius: '14px', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }
              : { borderRadius: '14px' }
            }
          >
            {profile?.is_following ? t('following_btn') : t('follow')}
          </button>
        )}
      </div>

      {/* Recipe Book */}
      <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 px-5 py-3">
          <BookOpen size={16} className="text-purple-400" />
          <h3 className="font-bold text-white">{t('recipeBook')}</h3>
          <span className="text-white/30 text-sm ml-auto">{filteredRecipes().length} {t('savedRecipesCount').toLowerCase()}</span>
        </div>

        {/* Alcohol type filter tabs */}
        {alcoholTypes.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 pb-3" style={{ scrollbarWidth: 'none' }}>
            {alcoholTypes.map(type => {
              const a = type === 'all' ? { key: 'all', label: t('all'), emoji: '🍸', color: '#8b5cf6' } : getAlcohol(type);
              const isActive = alcoholFilter === type;
              return (
                <button
                  key={type}
                  onClick={() => setAlcoholFilter(type)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={isActive
                    ? { background: `${a.color}30`, color: a.color, border: `1px solid ${a.color}55` }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }
                  }
                >
                  {a.emoji} {getAlcoholLabel(type, lang)}
                </button>
              );
            })}
          </div>
        )}

        <div className="px-4 space-y-3 pb-4">
          {filteredRecipes().length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📖</div>
              <p className="text-white/40 text-sm">
                {alcoholFilter !== 'all'
                  ? t('noTypeRecipes').replace('{type}', getAlcoholLabel(alcoholFilter, lang))
                  : isMe ? t('noRecipesProfileMe') : t('noRecipesProfileOther')}
              </p>
            </div>
          ) : (
            filteredRecipes().map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onOpen={openRecipe}
                onRemoved={id => { setRecipes(r => r.filter(x => x.id !== id)); }}
                onRatingChanged={(id, r) => setRecipes(prev => prev.map(x => x.id === id ? { ...x, rating: r } : x))}
              />
            ))
          )}
        </div>
      </div>

      {showMyBar && <MyBar onClose={() => setShowMyBar(false)} />}

      {activeStory && (
        <StoryViewer
          group={activeStory}
          initialIndex={0}
          onClose={() => setActiveStory(null)}
        />
      )}
    </div>
  );
}
