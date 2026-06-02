import React, { useState, useEffect, useCallback } from 'react';
import { X, Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Trash2, UtensilsCrossed, Clock, Zap, Eye } from 'lucide-react';
import Avatar from './Avatar';
import { getAlcohol, getAlcoholLabel, timeAgo, difficultyColor, getImageUrl } from '../utils';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function StoryViewer({ group, initialIndex = 0, onClose, onStorySaved, onDeleted }) {
  const { t, lang } = useLang();
  const { user: me } = useAuth();
  const [storyIdx, setStoryIdx] = useState(initialIndex);
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rating, setRating] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  // Viewers list (owner-only)
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  const stories = group.stories;
  const story = stories[storyIdx];
  const isOwner = me?.id === group.user_id;
  const DURATION = 8000;

  useEffect(() => {
    setSaved(!!story.saved);
    setRating(story.rating || null);
    setExpanded(false);
    setProgress(0);
    setPaused(false);
    setShowDeleteConfirm(false);
    api.post(`/stories/${story.id}/view`).catch(() => {});
  }, [story.id]);

  useEffect(() => {
    if (paused || expanded || showDeleteConfirm) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (storyIdx < stories.length - 1) {
            setStoryIdx(i => i + 1);
          } else {
            onClose();
          }
          return 0;
        }
        return p + (100 / (DURATION / 100));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [storyIdx, paused, expanded, showDeleteConfirm, stories.length]);

  const goNext = useCallback(() => {
    if (storyIdx < stories.length - 1) setStoryIdx(i => i + 1);
    else onClose();
  }, [storyIdx, stories.length]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) setStoryIdx(i => i - 1);
  }, [storyIdx]);

  const handleSave = async () => {
    if (saved) {
      await api.delete(`/stories/${story.id}/save`);
      setSaved(false);
      setRating(null);
      setShowRating(false);
    } else {
      setShowRating(true);
      setPaused(true);
    }
  };

  const confirmSave = async (r) => {
    await api.post(`/stories/${story.id}/save`, { rating: r });
    setSaved(true);
    setRating(r);
    setShowRating(false);
    setPaused(false);
    onStorySaved?.();
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await api.delete(`/stories/${story.id}`);
      onDeleted?.(story.id);
      onClose();
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const imageUrl = getImageUrl(story.image_url);
  const backgroundStyle = imageUrl
    ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(160deg, #1a0a2e 0%, #2d1b4e 40%, #1e0f35 100%)` };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <div className="w-full h-full flex flex-col" style={backgroundStyle}>

        {/* Overlay gradient */}
        {!imageUrl && (
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(ellipse at center top, rgba(139,92,246,0.15) 0%, transparent 60%)' }} />
        )}
        {imageUrl && (
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 30%, rgba(0,0,0,0.7) 70%)' }} />
        )}

        {/* Progress bars */}
        <div className="relative z-10 flex gap-1 px-3 pt-3">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.25)' }}>
              <div
                className="h-full rounded-full transition-none"
                style={{
                  background: 'white',
                  width: i < storyIdx ? '100%' : i === storyIdx ? `${progress}%` : '0%',
                  transition: i === storyIdx ? 'width 0.1s linear' : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <Avatar user={{ id: group.user_id, username: group.username }} size={36} />
            <div>
              <p className="font-semibold text-sm text-white">{group.username}</p>
              <p className="text-white/50 text-xs">{timeAgo(story.created_at, lang)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Delete button — only for story owner */}
            {isOwner && (
              <button
                onClick={() => { setShowDeleteConfirm(true); setPaused(true); }}
                className="text-white/50 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={onClose} className="text-white/70 hover:text-white p-1">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Tap zones */}
        <div className="relative z-10 flex flex-1">
          <div className="w-1/3 h-full" onClick={goPrev} />
          <div className="w-1/3 h-full" onClick={() => setPaused(p => !p)} />
          <div className="w-1/3 h-full" onClick={goNext} />
        </div>

        {/* Cocktail info card */}
        <div className="relative z-10">
          <div className="px-5 pb-3">
            <div className="flex flex-wrap gap-1 mb-2">
              {story.alcohol_types.map(type => {
                const a = getAlcohol(type);
                return (
                  <span key={type} className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${a.color}22`, color: a.color, border: `1px solid ${a.color}44` }}>
                    {a.emoji} {getAlcoholLabel(type, lang)}
                  </span>
                );
              })}
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">{story.cocktail_name}</h2>
            {story.description && <p className="text-white/60 text-sm mt-1">{story.description}</p>}

            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs flex items-center gap-1" style={{ color: difficultyColor[story.difficulty] }}>
                <Zap size={12} /> {story.difficulty}
              </span>
              <span className="text-xs flex items-center gap-1 text-white/50">
                <Clock size={12} /> {story.prep_time} min
              </span>
              {story.views_count > 0 && (
                <span className="text-xs text-white/40">{story.views_count} views</span>
              )}
            </div>
          </div>

          {/* Expandable recipe */}
          <div
            className="mx-3 mb-3 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-white"
              onClick={() => { setExpanded(e => !e); setPaused(true); }}
            >
              <span className="font-semibold text-sm">{t('viewFullRecipe')}</span>
              {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>

            {expanded && (
              <div className="px-4 pb-4 space-y-4 max-h-72 overflow-y-auto">
                <div>
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">{t('ingredients')}</h4>
                  <div className="space-y-1.5">
                    {story.ingredients.map((ing, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-white/80">{ing.name}</span>
                        <span className="text-white/50 font-mono">{ing.amount} {ing.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-2">{t('instructions')}</h4>
                  <ol className="space-y-2">
                    {story.instructions.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-purple-400 font-bold flex-shrink-0 w-5">{i + 1}.</span>
                        <span className="text-white/80">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {story.food_pairing && (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <UtensilsCrossed size={14} className="text-amber-400" />
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">{t('snackPairing')}</span>
                    </div>
                    <p className="text-white/70 text-sm">{story.food_pairing}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save button — only for other people's stories */}
          {!isOwner && (
            <div className="px-4 pb-6">
              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all"
                style={saved
                  ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd' }
                  : { background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', color: 'white' }
                }
              >
                {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                {saved ? `${t('saved')}${rating ? ` · ${rating}/10` : ''}` : t('saveToRecipeBook')}
              </button>
            </div>
          )}

          {/* Owner stats row — views is clickable to open viewers list */}
          {isOwner && (
            <div className="px-4 pb-6 flex gap-3 text-xs text-white/40 items-center">
              <button
                onClick={() => {
                  setShowViewers(true);
                  setPaused(true);
                  setViewersLoading(true);
                  api.get(`/stories/${story.id}/viewers`)
                    .then(r => setViewers(r.data))
                    .catch(() => setViewers([]))
                    .finally(() => setViewersLoading(false));
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-white/10 hover:text-white transition-colors"
              >
                <Eye size={12} /> {story.views_count || 0} {lang === 'he' ? 'צפיות' : 'views'}
              </button>
              <span>❤️ {story.likes_count || 0} {lang === 'he' ? 'לייקים' : 'likes'}</span>
              <span>🔖 {story.saves_count || 0} {lang === 'he' ? 'שמירות' : 'saves'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Rating modal */}
      {showRating && (
        <div className="absolute inset-0 z-20 flex items-end"
             style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full p-5 rounded-t-3xl slide-up" style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="text-lg font-bold text-white text-center mb-1">{t('rateCocktail')}</h3>
            <p className="text-white/40 text-sm text-center mb-5">{t('howMuchLoved')}</p>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => confirmSave(n)}
                  className="aspect-square rounded-xl flex items-center justify-center text-lg font-bold transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={() => confirmSave(null)}
              className="w-full py-2.5 text-white/40 text-sm hover:text-white/70"
            >
              {t('skipRating')}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6"
             style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full rounded-3xl p-6 text-center"
               style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-white mb-1">
              {lang === 'he' ? 'למחוק את הסטורי?' : 'Delete this story?'}
            </h3>
            <p className="text-white/40 text-sm mb-6">
              {lang === 'he'
                ? 'הפעולה בלתי הפיכה — כל הלייקים, השמירות והתגובות יימחקו'
                : 'This can\'t be undone — all likes and saves will be removed'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setPaused(false); }}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm text-white/60"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                disabled={deleting}
              >
                {lang === 'he' ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm text-white"
                style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none' }}
                disabled={deleting}
              >
                {deleting ? '...' : lang === 'he' ? 'מחק' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewers list modal — owner only */}
      {showViewers && (
        <div className="absolute inset-0 z-20 flex items-end"
             style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
             onClick={() => { setShowViewers(false); setPaused(false); }}>
          <div className="w-full rounded-t-3xl slide-up overflow-hidden"
               style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-purple-400" />
                <h3 className="font-bold text-white">
                  {lang === 'he' ? 'צפו בסטורי' : 'Viewers'}
                  <span className="ml-2 text-white/40 font-normal text-sm">({viewers.length})</span>
                </h3>
              </div>
              <button onClick={() => { setShowViewers(false); setPaused(false); }} className="text-white/50 hover:text-white">
                <X size={22} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {viewersLoading ? (
                <div className="flex justify-center py-10"><div className="text-2xl animate-bounce">👁</div></div>
              ) : viewers.length === 0 ? (
                <div className="px-5 py-12 text-center text-white/40 text-sm">
                  {lang === 'he' ? 'עוד אף אחד לא צפה בסטורי שלך' : 'No one has viewed your story yet'}
                </div>
              ) : (
                viewers.map(v => (
                  <div key={v.id} className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <Avatar user={v} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-white truncate">@{v.username}</div>
                      {v.bio && <div className="text-xs text-white/40 truncate">{v.bio}</div>}
                    </div>
                    <span className="text-xs text-white/30 flex-shrink-0">{timeAgo(v.viewed_at, lang)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
