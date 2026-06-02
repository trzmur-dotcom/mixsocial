import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, UserPlus, UserCheck } from 'lucide-react';
import StoryViewer from '../components/StoryViewer';
import Avatar from '../components/Avatar';
import { ALCOHOL_TYPES, getAlcohol, getAlcoholLabel, getImageUrl } from '../utils';
import { useLang } from '../context/LangContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const PAGE_SIZE = 30;
// Featured pattern: positions 0 and 8 are 2×2 (big), rest are 1×1
const isFeatured = (idx) => idx === 0 || idx === 8 || idx === 19 || idx === 27;

export default function Explore() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null); // null = "All"
  const [gridItems, setGridItems] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortedTypes, setSortedTypes] = useState(ALCOHOL_TYPES);
  const [topKey, setTopKey] = useState(null);
  const searchTimeout = useRef(null);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  // Load user preferences once
  useEffect(() => {
    api.get('/users/me/preferences').then(r => {
      const prefs = r.data;
      if (!prefs.length) return;
      const scoreMap = {};
      prefs.forEach(p => { scoreMap[p.key] = p.score; });
      const sorted = [...ALCOHOL_TYPES].sort((a, b) => (scoreMap[b.key] || 0) - (scoreMap[a.key] || 0));
      setSortedTypes(sorted);
      setTopKey(sorted[0]?.key || null);
    }).catch(() => {});
  }, []);

  // Fetch a page of grid items (initial or "load more")
  const fetchPage = useCallback(async (offset, replace) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (replace) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
      if (activeFilter) params.set('filter', activeFilter);
      if (query.trim()) params.set('q', query.trim());
      const url = query.trim()
        ? `/stories/search?${params.toString()}`
        : `/stories/explore?${params.toString()}`;
      const r = await api.get(url);
      const items = Array.isArray(r.data) ? r.data : [];
      setGridItems(prev => replace ? items : [...prev, ...items]);
      setHasMore(items.length >= PAGE_SIZE);
    } catch {
      if (replace) setGridItems([]);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeFilter, query]);

  // Reset & reload whenever filter or query changes
  useEffect(() => {
    setGridItems([]);
    setHasMore(true);
    fetchPage(0, true);
  }, [activeFilter, query, fetchPage]);

  // Debounced user search (only when typing in search box)
  const handleQueryChange = (val) => {
    setQuery(val);
    setActiveFilter(null);
    clearTimeout(searchTimeout.current);
    if (!val.trim()) { setUserResults([]); return; }
    searchTimeout.current = setTimeout(() => {
      api.get(`/users/search?q=${encodeURIComponent(val.trim())}`).then(r => setUserResults(r.data)).catch(() => setUserResults([]));
    }, 300);
  };

  const handleFollowToggle = async (user, idx) => {
    try {
      if (user.is_following) {
        await api.delete(`/users/${user.id}/follow`);
      } else {
        await api.post(`/users/${user.id}/follow`);
      }
      setUserResults(prev => prev.map((u, i) => i === idx ? { ...u, is_following: !u.is_following } : u));
    } catch {}
  };

  // Infinite scroll: when sentinel becomes visible, load next page
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingRef.current && hasMore) {
        fetchPage(gridItems.length, false);
      }
    }, { rootMargin: '300px' });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [gridItems.length, hasMore, loading, fetchPage]);

  const openStory = (story) => {
    setActiveGroup({ user_id: story.user_id, username: story.username, stories: [story], has_unviewed: true });
  };

  const handleFilterClick = (key) => {
    setQuery('');
    setUserResults([]);
    setActiveFilter(f => f === key ? null : key);
  };

  const handleAllClick = () => {
    setQuery('');
    setUserResults([]);
    setActiveFilter(null);
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 pt-4 pb-3"
           style={{ background: 'rgba(8,8,16,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="relative mb-3">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            style={{ paddingLeft: '2.75rem', paddingRight: query ? '2.75rem' : '1rem', borderRadius: '16px' }}
          />
          {query && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                    onClick={() => { setQuery(''); setUserResults([]); }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {/* All tab */}
          <button
            onClick={handleAllClick}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={!activeFilter && !query
              ? { background: 'rgba(139,92,246,0.3)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.55)' }
              : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            🍸 {t('all')}
          </button>

          {/* Sorted type chips */}
          {sortedTypes.map((a, idx) => (
            <button
              key={a.key}
              onClick={() => handleFilterClick(a.key)}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={activeFilter === a.key
                ? { background: `${a.color}33`, color: a.color, border: `1px solid ${a.color}66` }
                : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {a.emoji} {getAlcoholLabel(a.key, lang)}
              {idx === 0 && topKey && <span style={{ marginLeft: 1 }}>🔥</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── USER RESULTS (while typing in search) ── */}
      {query && userResults.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2">
            {lang === 'he' ? 'אנשים' : 'People'}
          </p>
          {userResults.map((user, idx) => (
            <div key={user.id}
                 className="flex items-center gap-3 py-2.5 border-b"
                 style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="cursor-pointer" onClick={() => navigate(`/profile/${user.id}`)}>
                <Avatar user={user} size={44} />
              </div>
              <div className="flex-1 cursor-pointer" onClick={() => navigate(`/profile/${user.id}`)}>
                <div className="font-semibold text-sm text-white">@{user.username}</div>
                {user.bio && <div className="text-xs text-white/40 mt-0.5 truncate max-w-[180px]">{user.bio}</div>}
                <div className="text-xs text-white/25 mt-0.5">{user.followers_count} {t('followers')}</div>
              </div>
              <button
                onClick={() => handleFollowToggle(user, idx)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={user.is_following
                  ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }
                  : { background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', color: '#fff', border: 'none' }
                }
              >
                {user.is_following
                  ? <><UserCheck size={12} /> {t('following_btn')}</>
                  : <><UserPlus size={12} /> {t('follow')}</>
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── GRID VIEW (always — All / filter / search) ── */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="text-3xl animate-bounce">🍹</div></div>
      ) : gridItems.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center px-6">
          <div className="text-5xl mb-3">{query ? '🔍' : '🍸'}</div>
          <p className="text-white/40 text-sm">
            {query
              ? `${t('noResults')} "${query}"`
              : activeFilter
                ? (lang === 'he' ? `אין עדיין קוקטיילים עם ${getAlcoholLabel(activeFilter, lang)} — היה הראשון!` : `No cocktails with ${getAlcoholLabel(activeFilter, lang)} yet — be the first!`)
                : (lang === 'he' ? 'עוד אין קוקטיילים — היה הראשון לשתף!' : 'No cocktails yet — be the first to share!')
            }
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', padding: '2px' }}>
            {gridItems.map((story, idx) => {
              const a = getAlcohol(story.alcohol_types?.[0]);
              const big = isFeatured(idx);
              return (
                <div
                  key={`${story.id}-${idx}`}
                  onClick={() => openStory(story)}
                  style={{
                    gridColumn: big ? 'span 2' : 'span 1',
                    gridRow: big ? 'span 2' : 'span 1',
                    aspectRatio: '1',
                    position: 'relative',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    background: a ? `linear-gradient(135deg,${a.color}18,${a.color}38,#080810)` : '#111120',
                  }}
                >
                  {story.image_url ? (
                    <img src={getImageUrl(story.image_url)} alt={story.cocktail_name}
                         style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: big ? 44 : 28, filter: `drop-shadow(0 0 ${big?24:14}px ${a?.color||'#8b5cf6'}66)` }}>
                      {a?.emoji || '🍸'}
                    </div>
                  )}

                  <div style={{ position: 'absolute', inset: 0,
                                background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)' }} />

                  {story._discover && (
                    <div style={{ position: 'absolute', top: 6, right: 6,
                                  background: 'rgba(139,92,246,0.85)', borderRadius: 999,
                                  fontSize: 9, fontWeight: 700, color: '#fff', padding: '2px 6px' }}>
                      {lang === 'he' ? 'גלה' : 'New'}
                    </div>
                  )}

                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: big ? '10px 10px 8px' : '6px 6px 5px' }}>
                    <div style={{ fontSize: big ? 12 : 9, fontWeight: 700, color: '#fff',
                                  lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,.8)',
                                  overflow: 'hidden', display: '-webkit-box',
                                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {story.cocktail_name}
                    </div>
                    {big && (
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                        @{story.username}
                      </div>
                    )}
                  </div>

                  <div style={{ position: 'absolute', top: 6, left: 6, width: 6, height: 6,
                                borderRadius: '50%', background: a?.color || '#8b5cf6',
                                boxShadow: `0 0 6px ${a?.color||'#8b5cf6'}` }} />
                </div>
              );
            })}
          </div>

          {/* Infinite-scroll sentinel + loader */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              {loadingMore && <div className="text-2xl animate-bounce">🍹</div>}
            </div>
          )}
        </>
      )}

      {activeGroup && (
        <StoryViewer
          group={activeGroup}
          initialIndex={0}
          onClose={() => setActiveGroup(null)}
        />
      )}
    </div>
  );
}
