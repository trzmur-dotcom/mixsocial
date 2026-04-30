import React, { useState, useEffect } from 'react';
import { BookOpen, Wine, Filter, Star } from 'lucide-react';
import RecipeCard from '../components/RecipeCard';
import MyBar from '../components/MyBar';
import StoryViewer from '../components/StoryViewer';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { getAlcohol, getAlcoholLabel, ALCOHOL_TYPES } from '../utils';
import api from '../api';

export default function RecipeBook() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [recipes, setRecipes] = useState([]);
  const [myBar, setMyBar] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [barMode, setBarMode] = useState(false);
  const [showMyBar, setShowMyBar] = useState(false);
  const [activeStory, setActiveStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recent');

  const loadData = async () => {
    setLoading(true);
    try {
      const [recRes, barRes] = await Promise.all([
        api.get(`/users/${user.id}/recipes`),
        api.get('/users/me/bar'),
      ]);
      setRecipes(recRes.data);
      setMyBar(barRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const alcoholTabs = ['all', ...Array.from(new Set(recipes.flatMap(r => r.alcohol_types)))];

  const getFiltered = () => {
    let r = recipes;
    if (barMode && myBar.length > 0) {
      r = r.filter(rec => rec.alcohol_types.some(type => myBar.includes(type)));
    }
    if (activeTab !== 'all') {
      r = r.filter(rec => rec.alcohol_types.includes(activeTab));
    }
    if (sortBy === 'rating') {
      r = [...r].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'recent') {
      r = [...r].sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));
    }
    return r;
  };

  const grouped = () => {
    const filtered = getFiltered();
    if (activeTab !== 'all') return { [activeTab]: filtered };

    const groups = {};
    filtered.forEach(r => {
      const type = r.alcohol_types[0] || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(r);
    });
    return groups;
  };

  const openRecipe = (recipe) => {
    setActiveStory({
      user_id: recipe.user_id,
      username: recipe.username,
      stories: [recipe],
      has_unviewed: false,
    });
  };

  const filtered = getFiltered();

  return (
    <div className="page">
      {/* Header */}
      <div className="sticky top-0 z-30"
           style={{ background: 'rgba(8,8,16,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-purple-400" />
            <h1 className="font-bold text-white text-lg">{t('recipeBook')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMyBar(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.25)' }}
            >
              <Wine size={13} /> {t('myBar')}
            </button>
          </div>
        </div>

        {/* Bar filter toggle */}
        {myBar.length > 0 && (
          <div className="px-5 pb-2">
            <button
              onClick={() => setBarMode(b => !b)}
              className="flex items-center gap-2 w-full px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all"
              style={barMode
                ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }
              }
            >
              <Wine size={16} />
              <span>{barMode ? t('showingBarRecipes') : t('filterByBar')}</span>
              {barMode && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.3)', color: '#a78bfa' }}>
                  {myBar.length} {t('spirits')}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Alcohol type tabs */}
        {alcoholTabs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 pb-3" style={{ scrollbarWidth: 'none' }}>
            {alcoholTabs.map(type => {
              const a = type === 'all'
                ? { key: 'all', label: t('all'), emoji: '🍸', color: '#8b5cf6' }
                : getAlcohol(type);
              const isActive = activeTab === type;
              const count = type === 'all' ? recipes.length : recipes.filter(r => r.alcohol_types.includes(type)).length;
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={isActive
                    ? { background: `${a.color}30`, color: a.color, border: `1px solid ${a.color}55` }
                    : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }
                  }
                >
                  {a.emoji} {getAlcoholLabel(type, lang)}
                  <span className="ml-0.5 opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Sort row */}
        {recipes.length > 0 && (
          <div className="flex items-center gap-2 px-5 pb-3">
            <span className="text-white/30 text-xs">{t('sortBy')}</span>
            {['recent', 'rating'].map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all"
                style={sortBy === s
                  ? { background: 'rgba(255,255,255,0.1)', color: 'white' }
                  : { color: 'rgba(255,255,255,0.3)' }
                }
              >
                {s === 'rating' && <Star size={10} />}
                {s === 'recent' ? t('recentlySaved') : t('highestRated')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="text-4xl animate-bounce">🍹</div></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center px-8">
          <div className="text-6xl mb-4">{barMode ? '🍶' : '📖'}</div>
          <p className="text-white/50 text-lg font-semibold mb-1">
            {barMode
              ? t('noMatchesBar')
              : recipes.length === 0
                ? t('noRecipesEmpty')
                : activeTab !== 'all'
                  ? t('noTypeRecipes').replace('{type}', getAlcoholLabel(activeTab, lang))
                  : t('noRecipesFilter')}
          </p>
          <p className="text-white/30 text-sm">
            {barMode ? t('addMoreSpirits') : t('startSaving')}
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {activeTab === 'all' && !barMode ? (
            Object.entries(grouped()).map(([type, items]) => {
              const a = getAlcohol(type);
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2 mt-2">
                    <span className="text-lg">{a.emoji}</span>
                    <h3 className="font-bold text-sm" style={{ color: a.color }}>{getAlcoholLabel(type, lang)}</h3>
                    <span className="text-white/30 text-xs">({items.length})</span>
                  </div>
                  <div className="space-y-3">
                    {items.map(recipe => (
                      <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        onOpen={openRecipe}
                        onRemoved={id => setRecipes(r => r.filter(x => x.id !== id))}
                        onRatingChanged={(id, r) => setRecipes(prev => prev.map(x => x.id === id ? { ...x, rating: r } : x))}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            filtered.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onOpen={openRecipe}
                onRemoved={id => setRecipes(r => r.filter(x => x.id !== id))}
                onRatingChanged={(id, r) => setRecipes(prev => prev.map(x => x.id === id ? { ...x, rating: r } : x))}
              />
            ))
          )}
        </div>
      )}

      {showMyBar && <MyBar onClose={() => { setShowMyBar(false); loadData(); }} />}

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
