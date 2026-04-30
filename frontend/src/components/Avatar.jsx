import React from 'react';
import { getAvatarGradient } from '../utils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Avatar({ user, size = 40, ring = false, ringViewed = false }) {
  const gradient = getAvatarGradient(user?.id || 1);
  const initials = (user?.username || '?')[0].toUpperCase();
  const avatarUrl = user?.avatar ? `${API_BASE}${user.avatar}` : null;

  const inner = (
    <div
      style={{
        width: size,
        height: size,
        background: avatarUrl ? 'transparent' : gradient,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
        color: 'white',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  );

  if (!ring) return inner;

  return (
    <div className={ringViewed ? 'story-ring-viewed' : 'story-ring'} style={{ display: 'inline-block' }}>
      <div style={{ background: '#080810', borderRadius: '50%', padding: 2 }}>
        {inner}
      </div>
    </div>
  );
}
