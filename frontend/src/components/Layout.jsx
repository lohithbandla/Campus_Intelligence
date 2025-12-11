import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import ChatbotButton from './common/Chatbot/ChatbotButton.jsx';
import { Outlet } from 'react-router-dom';

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ✅ MOVE user + role INSIDE component
  const user = JSON.parse(localStorage.getItem("user"));
  const role = user?.role || "user";

  return (
    <div className="flex h-screen flex-col bg-slate-100 overflow-hidden">
      
      {/* --- NAVBAR --- */}
      <header className="flex h-16 shrink-0 items-center justify-between bg-white px-4 shadow-sm border-b border-slate-200 z-50 relative">
        
        {/* Left Section */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white font-bold">S</div>
            <span className="text-xl font-bold text-slate-800">Soochna</span>
          </div>
        </div>

        {/* Right Section (Role + System text) */}
        <div className="flex items-center gap-6">
          
          {/* ⭐ ROLE LABEL */}
          <div className="hidden md:flex flex-col text-right leading-tight">
            <span className="text-xs text-slate-400">Logged in as</span>
            <span className="text-sm font-semibold text-slate-700 capitalize">
              {role}
            </span>
          </div>

          <span className="hidden md:block text-sm font-medium text-slate-500">
            College Management System
          </span>
        </div>

      </header>

      {/* --- MAIN WRAPPER --- */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex flex-1 flex-col overflow-hidden relative w-full bg-slate-50">
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl">
              {children || <Outlet />}
            </div>
          </div>

          <footer className="bg-white border-t border-slate-200 py-4 text-center text-sm text-slate-500 shrink-0">
            &copy; {new Date().getFullYear()} Soochna. All rights reserved.
          </footer>

          <ChatbotButton />
        </main>
      </div>
    </div>
  );
};

export default Layout;
