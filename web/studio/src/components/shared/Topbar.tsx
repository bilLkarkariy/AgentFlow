import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bars3Icon,
  ChevronDownIcon,
  UserCircleIcon,
  BookOpenIcon,
  Squares2X2Icon,
  LifebuoyIcon,
} from '@heroicons/react/24/outline';

interface TopbarProps {
  onToggleSidebar?: () => void;
}

const links = [
  { to: '/marketplace', label: 'Marketplace', Icon: Squares2X2Icon },
  { to: '/templates', label: 'Modèles', Icon: BookOpenIcon },
  { to: '/help', label: 'Aide', Icon: LifebuoyIcon },
];

const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <header className="h-16 shrink-0 bg-white border-b border-line flex items-center px-5 justify-between relative z-10">
      <div className="flex items-center gap-1">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title="Ouvrir le menu"
            className="lg:hidden mr-2 p-1.5 rounded-md text-inkmute hover:bg-canvas"
          >
            <Bars3Icon className="w-5 h-5" strokeWidth={1.7} />
          </button>
        )}
        <nav className="flex items-center gap-0.5">
          {links.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[13px] text-inkmute hover:text-ink hover:bg-canvas transition-colors"
            >
              <Icon className="w-[15px] h-[15px]" strokeWidth={1.7} />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div ref={avatarRef} className="relative">
        <button
          onClick={() => setAvatarOpen(!avatarOpen)}
          className="flex items-center gap-1 pl-1 pr-1.5 h-9 rounded-md hover:bg-canvas transition-colors"
        >
          <UserCircleIcon className="w-7 h-7 text-inkmute" strokeWidth={1.4} />
          <ChevronDownIcon className="w-3.5 h-3.5 text-inkmute" strokeWidth={2} />
        </button>
        {avatarOpen && (
          <div className="absolute right-0 mt-1.5 bg-white shadow-lg shadow-ink/5 rounded-lg border border-line w-44 py-1 overflow-hidden">
            <Link to="/profile" className="block px-3 py-2 text-[13px] text-ink hover:bg-canvas">Profil</Link>
            <Link to="/settings" className="block px-3 py-2 text-[13px] text-ink hover:bg-canvas">Paramètres</Link>
            <div className="h-px bg-line my-1" />
            <button className="w-full text-left px-3 py-2 text-[13px] text-ink hover:bg-canvas">Se déconnecter</button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
