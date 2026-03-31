import React from 'react';
import { Home, List, TrendingUp, TrendingDown, Mail, LayoutDashboard, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const menuItems = [
    { id: 'home', label: '홈 페이지', icon: Home },
    { id: 'plan', label: '계획 리스트', icon: TrendingUp },
    { id: 'usage', label: '사용 리스트', icon: TrendingDown },
    { id: 'mail', label: 'EK메일', icon: Mail, external: 'https://ekk.daouoffice.com/login' },
    { id: 'dashboard', label: '데시보드', icon: LayoutDashboard },
  ];

  return (
    <div className="w-52 bg-white border-r border-slate-200 h-screen flex flex-col">
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
    </div>
  );
};
