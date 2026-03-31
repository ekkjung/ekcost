import React, { useEffect, useState } from 'react';
import { Home, List, TrendingUp, TrendingDown, History, Mail, LayoutDashboard, X, LogIn, LogOut, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from '../firebase';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const menuItems = [
    { id: 'home', label: '홈 페이지', icon: Home },
    { id: 'plan', label: '계획 리스트', icon: TrendingUp },
    { id: 'usage', label: '사용 리스트', icon: TrendingDown },
    { id: 'history', label: '변경 이력', icon: History },
    { id: 'mail', label: 'EK메일', icon: Mail, external: 'https://ekk.daouoffice.com/login' },
    { id: 'dashboard', label: '데시보드', icon: LayoutDashboard },
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 h-screen flex flex-col">
      <div className="p-6 font-bold text-xl text-blue-600">EK 생산기술팀</div>
      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.external) {
                window.open(item.external, '_blank');
              } else {
                setActivePage(item.id);
              }
            }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
              activePage === item.id 
                ? "bg-blue-50 text-blue-600" 
                : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{user.displayName || '사용자'}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-all"
            >
              <LogOut className="w-5 h-5" />
              로그아웃
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-blue-600 hover:bg-blue-50 transition-all"
          >
            <LogIn className="w-5 h-5" />
            로그인
          </button>
        )}
      </div>
    </div>
  );
};
