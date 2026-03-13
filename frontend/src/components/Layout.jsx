import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

const Layout = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-100">
      {user && (
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        />
      )}

      <div
        className={`flex min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-300 ${
          user ? (sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72') : ''
        }`}
      >
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
