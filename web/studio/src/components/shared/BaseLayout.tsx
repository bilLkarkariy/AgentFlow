import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ToastProvider from './Toast';

const BaseLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <>
      <ToastProvider />
      <div className="flex h-screen">
        {/* Mobile drawer */}
        <div
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-300 lg:hidden ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar />
        </div>
        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col">
          <Topbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <main className="p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export default BaseLayout;
