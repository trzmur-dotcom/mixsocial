import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Search, BookOpen, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function BottomNav() {
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const items = [
    { to: '/', icon: Home, label: t('home') },
    { to: '/explore', icon: Search, label: t('explore') },
    { to: '/recipes', icon: BookOpen, label: t('recipes') },
    { to: `/profile/${user?.id}`, icon: User, label: t('profile') },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50"
         style={{ background: 'rgba(8,8,16,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 gap-0.5 transition-all ${
                isActive ? 'text-purple-400' : 'text-white/30 hover:text-white/60'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
