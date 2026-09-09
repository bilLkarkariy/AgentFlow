import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ToastProvider from './Toast';

const STORAGE_KEY = 'agentflow.sidebar.collapsed';

const BaseLayout: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch { /* stockage indisponible */ }
  }, [collapsed]);

  return (
    <>
      <ToastProvider />
      <div className="flex h-screen bg-canvas">
        {/* Tiroir mobile */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:hidden ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar />
        </div>
        {drawerOpen && (
          <div
            className="fixed inset-0 bg-ink/40 z-40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Rail de navigation */}
        <div className="hidden lg:flex lg:shrink-0">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onToggleSidebar={() => setDrawerOpen(!drawerOpen)} />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export default BaseLayout;
