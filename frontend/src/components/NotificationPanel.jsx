import React, { useEffect, useState, useCallback } from 'react';
import { X, Heart, Bookmark, Users, UserPlus, UserCheck } from 'lucide-react';
import Avatar from './Avatar';
import { timeAgo } from '../utils';
import { useLang } from '../context/LangContext';
import api from '../api';

const TYPE_META = {
  like: {
    icon: <Heart size={14} fill="#f43f5e" style={{ color: '#f43f5e' }} />,
    bg: 'rgba(244,63,94,0.12)',
    border: 'rgba(244,63,94,0.25)',
  },
  save: {
    icon: <Bookmark size={14} style={{ color: '#a78bfa' }} />,
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.25)',
  },
  friend_save: {
    icon: <Users size={14} style={{ color: '#34d399' }} />,
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.25)',
  },
  follow: {
    icon: <UserPlus size={14} style={{ color: '#60a5fa' }} />,
    bg: 'rgba(96,165,250,0.12)',
    border: 'rgba(96,165,250,0.25)',
  },
  follow_request: {
    icon: <UserPlus size={14} style={{ color: '#fbbf24' }} />,
    bg: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.30)',
  },
  follow_accepted: {
    icon: <UserCheck size={14} style={{ color: '#34d399' }} />,
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.25)',
  },
};

function notifText(n, lang) {
  const name = `@${n.actor_username}`;
  const story = n.story_name ? `"${n.story_name}"` : '';
  if (lang === 'he') {
    if (n.type === 'like') return `${name} עשה לך לייק על ${story}`;
    if (n.type === 'save') return `${name} שמר את המתכון שלך ${story}`;
    if (n.type === 'friend_save') return `${name} שמר את ${story} — אולי גם לך יעניין?`;
    if (n.type === 'follow') return `${name} התחיל לעקוב אחריך`;
    if (n.type === 'follow_request') return `${name} שלח בקשה לעקוב אחריך`;
    if (n.type === 'follow_accepted') return `${name} אישר את בקשת המעקב שלך`;
    return `${name} ${story}`;
  }
  if (n.type === 'like') return `${name} liked your cocktail ${story}`;
  if (n.type === 'save') return `${name} saved your recipe ${story}`;
  if (n.type === 'friend_save') return `${name} saved ${story} — you might like it too!`;
  if (n.type === 'follow') return `${name} started following you`;
  if (n.type === 'follow_request') return `${name} wants to follow you`;
  if (n.type === 'follow_accepted') return `${name} accepted your follow request`;
  return `${name} ${story}`;
}

export default function NotificationPanel({ onClose, onRead }) {
  const { lang } = useLang();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    // Mark all as read after a short delay so unread dots are visible briefly
    const timer = setTimeout(async () => {
      try {
        await api.put('/notifications/read');
        onRead?.(); // tell Home to reset the badge
      } catch {}
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = async (actorId) => {
    try { await api.post(`/users/${actorId}/follow/accept`); } catch {}
    setNotifications(prev => prev
      .filter(n => !(n.type === 'follow_request' && n.actor_id === actorId))
      .concat([{ id: `accepted-${actorId}-${Date.now()}`, type: 'follow', actor_id: actorId,
                 actor_username: prev.find(n => n.actor_id === actorId)?.actor_username,
                 actor_avatar:   prev.find(n => n.actor_id === actorId)?.actor_avatar,
                 created_at: new Date().toISOString(), read: 0 }]));
  };
  const handleReject = async (actorId) => {
    try { await api.post(`/users/${actorId}/follow/reject`); } catch {}
    setNotifications(prev => prev.filter(n => !(n.type === 'follow_request' && n.actor_id === actorId)));
  };

  const requests   = notifications.filter(n => n.type === 'follow_request');
  const likes      = notifications.filter(n => n.type === 'like');
  const saves      = notifications.filter(n => n.type === 'save');
  const friendSaves = notifications.filter(n => n.type === 'friend_save');
  const follows    = notifications.filter(n => n.type === 'follow' || n.type === 'follow_accepted');

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed bottom-0 left-1/2 z-50 w-full overflow-hidden"
        style={{
          maxWidth: 480,
          transform: 'translateX(-50%)',
          borderRadius: '20px 20px 0 0',
          background: 'linear-gradient(180deg, #0f0f1e 0%, #080810 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-white font-bold text-lg">
            {lang === 'he' ? '🔔 התראות' : '🔔 Notifications'}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 pb-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="text-3xl animate-bounce">🍹</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="text-5xl mb-3">🔕</div>
              <p className="text-white/40 text-sm">
                {lang === 'he' ? 'אין התראות עדיין' : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <>
              {requests.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-bold text-amber-400/70 uppercase tracking-wider mb-2 mt-2">
                    {lang === 'he' ? '⏳ בקשות מעקב' : '⏳ Follow requests'}
                  </p>
                  <div className="flex flex-col gap-2">
                    {requests.map(n => (
                      <div key={n.id}
                           className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                           style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)' }}>
                        <Avatar user={{ id: n.actor_id, username: n.actor_username, avatar: n.actor_avatar }} size={38} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white/90 text-xs leading-snug font-semibold">
                            @{n.actor_username}
                          </p>
                          <p className="text-white/50 text-[11px]">
                            {lang === 'he' ? 'רוצה לעקוב אחריך' : 'wants to follow you'}
                          </p>
                        </div>
                        <button onClick={() => handleAccept(n.actor_id)}
                                className="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                                style={{ background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', color: 'white' }}>
                          {lang === 'he' ? 'אישור' : 'Accept'}
                        </button>
                        <button onClick={() => handleReject(n.actor_id)}
                                className="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}>
                          {lang === 'he' ? 'דחיה' : 'Reject'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Section
                title={lang === 'he' ? '❤️ לייקים' : '❤️ Likes'}
                items={likes}
                lang={lang}
              />
              <Section
                title={lang === 'he' ? '🔖 מתכונים שנשמרו' : '🔖 Recipe saves'}
                items={saves}
                lang={lang}
              />
              <Section
                title={lang === 'he' ? '🍸 חברים שמרו' : '🍸 Friends saved'}
                items={friendSaves}
                lang={lang}
              />
              <Section
                title={lang === 'he' ? '👥 עוקבים' : '👥 Followers'}
                items={follows}
                lang={lang}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ title, items, lang }) {
  if (!items.length) return null;
  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2 mt-2">
        {title}
      </p>
      <div className="flex flex-col gap-2">
        {items.map(n => {
          const meta = TYPE_META[n.type] || TYPE_META.like;
          return (
            <div
              key={n.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{
                background: n.read ? 'rgba(255,255,255,0.03)' : meta.bg,
                border: `1px solid ${n.read ? 'rgba(255,255,255,0.06)' : meta.border}`,
                transition: 'background 0.3s',
              }}
            >
              {/* Avatar + type icon */}
              <div className="relative flex-shrink-0">
                <Avatar user={{ id: n.actor_id, username: n.actor_username, avatar: n.actor_avatar }} size={38} />
                <div
                  className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center"
                  style={{ width: 18, height: 18, background: '#080810', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {meta.icon}
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-xs leading-snug"
                   style={{ fontWeight: n.read ? 400 : 600 }}>
                  {notifText(n, lang)}
                </p>
                <p className="text-white/30 text-[10px] mt-0.5">{timeAgo(n.created_at, lang)}</p>
              </div>

              {/* Unread dot */}
              {!n.read && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
