import React, { useState } from 'react';
import { Star, Clock, Zap, UtensilsCrossed, ChevronDown, ChevronUp, Bookmark, BookmarkX } from 'lucide-react';
import { getAlcohol, getAlcoholLabel, difficultyColor, timeAgo } from '../utils';
import { useLang } from '../context/LangContext';
import api from '../api';

export default function RecipeCard({ recipe, onOpen, onRemoved, onRatingChanged }) {
  const { t, lang } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(recipe.rating);
  const [showRating, setShowRating] = useState(false);

  const handleRating = async (r) => {
    await api.patch(`/stories/${recipe.id}/rating`, { rating: r });
    setRating(r);
    setShowRating(false);
    onRatingChanged?.(recipe.id, r);
  };

  const handleRemove = async () => {
    await api.delete(`/stories/${recipe.id}/save`);
    onRemoved?.(recipe.id);
  };

  return (
    <div className="rounded-2xl overflow-hidden fade-in"
         style={{ background: '#111120', border: '1px solid rgba(255,255,255,0.07)' }}>

      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={() => onOpen?.(recipe)}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-base truncate">{recipe.cocktail_name}</h3>
            <p className="text-white/40 text-xs mt-0.5">by {recipe.username} · {timeAgo(recipe.saved_at, lang)}</p>
          </div>
          {rating && (
            <div className="flex items-center gap-1 flex-shrink-0"
                 style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                          borderRadius: '20px', padding: '2px 10px' }}>
              <Star size={12} className="text-amber-400" fill="currentColor" />
              <span className="text-amber-400 font-bold text-sm">{rating}</span>
              <span className="text-amber-400/50 text-xs">/10</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          {recipe.alcohol_types.map(type => {
            const a = getAlcohol(type);
            return (
              <span key={type} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${a.color}18`, color: a.color, border: `1px solid ${a.color}33` }}>
                {a.emoji} {getAlcoholLabel(type, lang)}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-white/40">
          <span className="flex items-center gap-1" style={{ color: difficultyColor[recipe.difficulty] }}>
            <Zap size={11} /> {recipe.difficulty}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} /> {recipe.prep_time} min
          </span>
          <span>{recipe.ingredients?.length} ingredients</span>
        </div>
      </div>

      {/* Expand/collapse */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: expanded ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
      >
        <span>{t('viewRecipe')}</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-4 fade-in">
          {/* Ingredients */}
          <div>
            <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">{t('ingredients')}</p>
            <div className="space-y-1.5">
              {recipe.ingredients?.map((ing, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-white/70">{ing.name}</span>
                  <span className="text-white/40 font-mono text-xs">{ing.amount} {ing.unit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <p className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-2">{t('instructions')}</p>
            <ol className="space-y-1.5">
              {recipe.instructions?.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-purple-400 font-bold flex-shrink-0 w-4">{i+1}.</span>
                  <span className="text-white/70">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Food pairing */}
          {recipe.food_pairing && (
            <div className="rounded-xl p-3 flex items-start gap-2"
                 style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <UtensilsCrossed size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-white/60 text-xs">{recipe.food_pairing}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => { setShowRating(s => !s); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <Star size={13} fill={rating ? 'currentColor' : 'none'} />
          {rating ? `${t('rate')}: ${rating}/10` : t('rate')}
        </button>
        <button
          onClick={handleRemove}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <BookmarkX size={13} />
          {t('remove')}
        </button>
      </div>

      {/* Rating picker */}
      {showRating && (
        <div className="px-4 pb-4 fade-in">
          <div className="grid grid-cols-5 gap-2">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button
                key={n}
                onClick={() => handleRating(n)}
                className="aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all hover:scale-110"
                style={{
                  background: rating === n ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.05)',
                  border: rating === n ? '1px solid rgba(245,158,11,0.6)' : '1px solid rgba(255,255,255,0.08)',
                  color: rating === n ? '#fbbf24' : 'white',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
