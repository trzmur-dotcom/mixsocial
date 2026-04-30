import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import StoriesRow from '../components/StoriesRow';
import StoryViewer from '../components/StoryViewer';
import FeedCard from '../components/FeedCard';
import UploadStory from '../components/UploadStory';
import NotificationPanel from '../components/NotificationPanel';
import { useLang } from '../context/LangContext';
import api from '../api';

export default function Home() {
  const { t, toggle, lang } = useLang();
  const [groups, setGroups] = useState([]);
  const [feed, setFeed] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(null);
  const pageRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [groupsRes, feedRes] = await Promise.all([
        api.get('/stories/grouped'),
        api.get('/stories/feed'),
      ]);
      setGroups(groupsRes.data);
      setFeed(feedRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    fetchUnread();
    // Poll for new notifications every 60 seconds
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, []);

  const openStory = (group) => {
    const firstUnviewed = group.stories.findIndex(s => !s.viewed);
    setActiveStoryIndex(firstUnviewed >= 0 ? firstUnviewed : 0);
    setActiveGroup(group);
  };

  const openFromFeed = (story) => {
    const group = groups.find(g => g.user_id === story.user_id);
    if (group) {
      const idx = group.stories.findIndex(s => s.id === story.id);
      setActiveStoryIndex(idx >= 0 ? idx : 0);
      setActiveGroup(group);
    } else {
      setActiveGroup({ user_id: story.user_id, username: story.username, stories: [story], has_unviewed: true });
      setActiveStoryIndex(0);
    }
  };

  const handleTouchStart = (e) => {
    const el = pageRef.current;
    if (el && el.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0 && dy < 80) setPullY(dy);
  };

  const handleTouchEnd = async () => {
    if (pullY > 55 && !refreshing) {
      setRefreshing(true);
      setPullY(0);
      touchStartY.current = null;
      await load();
      setRefreshing(false);
    } else {
      setPullY(0);
      touchStartY.current = null;
    }
  };

  const handleBell = () => {
    setShowNotifications(true);
  };

  const handleNotificationsClose = () => {
    setShowNotifications(false);
  };

  const handleNotificationsRead = () => {
    setUnreadCount(0);
  };

  return (
    <div
      className="page"
      ref={pageRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3"
           style={{ background: 'rgba(8,8,16,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
          MixSocial
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
          >
            🌐
          </button>

          {/* Bell with unread badge */}
          <button
            onClick={handleBell}
            className="relative text-white/50 hover:text-white transition-colors"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span
                className="absolute flex items-center justify-center text-white font-bold"
                style={{
                  top: -4, right: -4,
                  minWidth: 17, height: 17,
                  borderRadius: 999,
                  background: 'linear-gradient(135deg,#f43f5e,#e11d48)',
                  fontSize: 9,
                  lineHeight: 1,
                  padding: '0 3px',
                  border: '1.5px solid #080810',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Pull-to-refresh indicator */}
      {(pullY > 10 || refreshing) && (
        <div className="flex justify-center items-center"
             style={{ height: refreshing ? 40 : Math.min(pullY * 0.6, 40), overflow: 'hidden', transition: refreshing ? 'none' : 'height 0.1s' }}>
          <div className={`text-2xl ${refreshing ? 'animate-spin' : ''}`} style={{ opacity: refreshing ? 1 : pullY / 55 }}>
            🍹
          </div>
        </div>
      )}

      {/* Stories row */}
      <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <StoriesRow
          groups={groups}
          onStoryClick={openStory}
          onAddClick={() => setShowUpload(true)}
        />
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-4xl animate-bounce">🍹</div>
        </div>
      ) : feed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <div className="text-6xl mb-4">🍸</div>
          <p className="text-white/50 text-lg font-semibold mb-1">
            {lang === 'he' ? 'עדיין אין קוקטיילים' : 'No cocktails yet'}
          </p>
          <p className="text-white/30 text-sm">
            {lang === 'he' ? 'היה הראשון לשתף מתכון!' : 'Be the first to share a recipe!'}
          </p>
        </div>
      ) : (
        <div>
          {feed.map(story => (
            <FeedCard
              key={story.id}
              story={story}
              onOpen={openFromFeed}
              onSaveChanged={load}
            />
          ))}
        </div>
      )}

      {/* Story viewer */}
      {activeGroup && (
        <StoryViewer
          group={activeGroup}
          initialIndex={activeStoryIndex}
          onClose={() => { setActiveGroup(null); load(); }}
          onStorySaved={load}
          onDeleted={() => { setActiveGroup(null); load(); }}
        />
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadStory
          onClose={() => setShowUpload(false)}
          onUploaded={load}
        />
      )}

      {/* Notification panel */}
      {showNotifications && (
        <NotificationPanel
          onClose={handleNotificationsClose}
          onRead={handleNotificationsRead}
        />
      )}
    </div>
  );
}
