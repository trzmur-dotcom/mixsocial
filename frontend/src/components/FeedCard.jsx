import React, { useState } from 'react';
import { Bookmark, BookmarkCheck, Eye, Clock, Zap, UtensilsCrossed, Heart } from 'lucide-react';
import Avatar from './Avatar';
import { getAlcohol, getAlcoholLabel, timeAgo, difficultyColor, getImageUrl } from '../utils';
import { useLang } from '../context/LangContext';
import api from '../api';

export default function FeedCard({ story, onOpen, onSaveChanged }) {
  const { t, lang } = useLang();
  const [saved, setSaved] = useState(!!story.saved);
  const [rating, setRating] = useState(story.rating || null);
  const [liked, setLiked] = useState(!!story.liked);
  const [likesCount, setLikesCount] = useState(story.likes_count || 0);

  const handleSave = async (e) => {
    e.stopPropagation();
    try {
      if (saved) {
        await api.delete(`/stories/${story.id}/save`);
        setSaved(false);
        setRating(null);
        onSaveChanged?.();
      } else {
        await api.post(`/stories/${story.id}/save`, { rating: null });
        setSaved(true);
        onSaveChanged?.();
      }
    } catch {}
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    try {
      if (liked) {
        await api.delete(`/stories/${story.id}/like`);
        setLiked(false);
        setLikesCount(c => Math.max(0, c - 1));
      } else {
        await api.post(`/stories/${story.id}/like`);
        setLiked(true);
        setLikesCount(c => c + 1);
      }
    } catch {}
  };

  const cocktailGradient = () => {
    const colors = [
      'linear-gradient(135deg,#1a0533,#2d1b4e,#1e0a3c)',
      'linear-gradient(135deg,#0a1628,#1e3a5f,#0d2137)',
      'linear-gradient(135deg,#1a0a0a,#3d1515,#1a0a0a)',
      'linear-gradient(135deg,#0a1a0a,#153d15,#0a1a0a)',
      'linear-gradient(135deg,#1a1200,#3d2e00,#1a1200)',
    ];
    return colors[story.id % colors.length];
  };

  const imageUrl = getImageUrl(story.image_url);

  return (
    <div className="mx-0 border-b fade-in" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onOpen(story)}>
          <Avatar user={{ id: story.user_id, username: story.username }} size={36} />
          <div>
            <p className="font-semibold text-sm text-white">{story.username}</p>
            <p className="text-white/40 text-xs">{timeAgo(story.created_at, lang)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {story.alcohol_types.slice(0, 2).map(type => {
            const a = getAlcohol(type);
            return (
              <span key={type} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${a.color}22`, color: a.color, border: `1px solid ${a.color}33` }}>
                {a.emoji} {getAlcoholLabel(type, lang)}
              </span>
            );
          })}
        </div>
      </div>

      {/* Image / visual */}
      <div
        className="w-full cursor-pointer relative"
        style={{ aspectRatio: '1/1', background: cocktailGradient() }}
        onClick={() => onOpen(story)}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={story.cocktail_name} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
            <div className="text-7xl mb-3" style={{ filter: 'drop-shadow(0 0 30px rgba(139,92,246,0.5))' }}>
              {story.alcohol_types[0] ? getAlcohol(story.alcohol_types[0]).emoji : '🍹'}
            </div>
            <p className="text-white/20 text-xs">{lang === 'he' ? 'לחץ לצפייה במתכון' : 'Tap to view recipe'}</p>
          </div>
        )}

        {/* Overlay info */}
        <div className="absolute bottom-0 left-0 right-0 p-4"
             style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
          <h3 className="text-white font-bold text-xl leading-tight">{story.cocktail_name}</h3>
          {story.description && (
            <p className="text-white/60 text-sm mt-0.5 line-clamp-1">{story.description}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          {/* Stats + like */}
          <div className="flex items-center gap-3 text-white/40 text-xs">
            <button
              onClick={handleLike}
              className="flex items-center gap-1 transition-all"
              style={{ color: liked ? '#f43f5e' : 'rgba(255,255,255,0.4)' }}
            >
              <Heart
                size={16}
                fill={liked ? '#f43f5e' : 'none'}
                style={{ transition: 'transform 0.15s', transform: liked ? 'scale(1.2)' : 'scale(1)' }}
              />
              <span>{likesCount > 0 ? likesCount : ''}</span>
            </button>
            <span className="flex items-center gap-1"><Eye size={14} /> {story.views_count || 0}</span>
            <span className="flex items-center gap-1"><Bookmark size={14} /> {story.saves_count || 0}</span>
            <span className="flex items-center gap-1" style={{ color: difficultyColor[story.difficulty] }}>
              <Zap size={14} /> {story.difficulty}
            </span>
            <span className="flex items-center gap-1"><Clock size={14} /> {story.prep_time}m</span>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={saved
              ? { background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)' }
              : { background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {saved ? (rating ? `${rating}/10` : t('saved')) : t('save')}
          </button>
        </div>

        {/* Food pairing teaser */}
        {story.food_pairing && (
          <div className="flex items-start gap-2 py-2 px-3 rounded-xl"
               style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
            <UtensilsCrossed size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-white/50 text-xs line-clamp-1">
              <span className="text-amber-500/80 font-medium">{t('pairsWith')} </span>
              {story.food_pairing}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
