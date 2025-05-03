import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bars3Icon, ChevronDownIcon, UserCircleIcon } from '@heroicons/react/24/outline';

interface TopbarProps {
  onToggleSidebar?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const [studioOpen, setStudioOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const studioRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (studioRef.current && !studioRef.current.contains(e.target as Node)) setStudioOpen(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-white border-b flex items-center px-6 justify-between relative z-10">
      <div className="flex items-center">
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} className="lg:hidden mr-4">
            <Bars3Icon className="h-6 w-6 text-gray-800" />
          </button>
        )}
        <div ref={studioRef} className="relative">
          <button onClick={() => setStudioOpen(!studioOpen)} className="flex items-center text-gray-800">
            AgentFlow <ChevronDownIcon className="h-4 w-4 ml-1" />
          </button>
          {studioOpen && (
            <div className="absolute left-0 mt-2 bg-white shadow-lg rounded border w-40">
              <Link to="/dashboard" className="block px-4 py-2 hover:bg-gray-100">Dashboard</Link>
              <Link to="/flows" className="block px-4 py-2 hover:bg-gray-100">Flows</Link>
            </div>
          )}
        </div>
        <nav className="ml-8 flex items-center space-x-4">
          <Link to="/dashboard" className="text-gray-600 hover:text-gray-800">Dashboard</Link>
          <Link to="/marketplace" className="text-gray-600 hover:text-gray-800">Marketplace</Link>
          <Link to="/help" className="text-gray-600 hover:text-gray-800">Aide</Link>
        </nav>
      </div>
      <div ref={avatarRef} className="relative">
        <button onClick={() => setAvatarOpen(!avatarOpen)} className="flex items-center">
          <UserCircleIcon className="h-8 w-8 text-gray-800" />
          <ChevronDownIcon className="h-4 w-4 ml-1" />
        </button>
        {avatarOpen && (
          <div className="absolute right-0 mt-2 bg-white shadow-lg rounded border w-40">
            <Link to="/profile" className="block px-4 py-2 hover:bg-gray-100">Profile</Link>
            <Link to="/settings" className="block px-4 py-2 hover:bg-gray-100">Paramètres</Link>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100">Se déconnecter</button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
