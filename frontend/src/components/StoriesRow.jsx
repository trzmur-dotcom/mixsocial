import React from 'react';
import { Plus } from 'lucide-react';
import Avatar from './Avatar';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function StoriesRow({ groups, onStoryClick, onAddClick }) {
  const { user } = useAuth();
  const { t } = useLang();

  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-3 scrollbar-hide"
         style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

      {/* Add story button */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer" onClick={onAddClick}>
        <div className="relative">
          <div className="story-ring-viewed" style={{ display: 'inline-block' }}>
            <div style={{ background: '#080810', borderRadius: '50%', padding: 2 }}>
              <Avatar user={user} size={56} />
            </div>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#8b5cf6,#ec4899)' }}>
            <Plus size={12} color="white" strokeWidth={3} />
          </div>
        </div>
        <span className="text-[11px] text-white/50 w-16 text-center truncate">{t('yourStory')}</span>
      </div>

      {/* Story groups */}
      {groups.map(group => (
        <div
          key={group.user_id}
          className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer"
          onClick={() => onStoryClick(group)}
        >
          <Avatar user={{ id: group.user_id, username: group.username }} size={56} ring ringViewed={!group.has_unviewed} />
          <span className="text-[11px] text-white/60 w-16 text-center truncate"
                style={{ fontWeight: group.has_unviewed ? 600 : 400 }}>
            {group.username}
          </span>
        </div>
      ))}
    </div>
  );
}
