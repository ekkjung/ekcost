import React from 'react';
import { Home, List, TrendingUp, TrendingDown, Mail, LayoutDashboard, X, Layers, Folder, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const mainItems = [
    { id: 'home', label: '홈 페이지', icon: Home },
    { id: 'plan', label: '계획 리스트', icon: TrendingUp },
    { id: 'usage', label: '사용 리스트', icon: TrendingDown },
    { id: 'dashboard', label: '데시보드', icon: LayoutDashboard },
  ];

  const workItems = [
    { id: 'mail', label: 'EK메일', icon: Mail, external: 'https://ekk.daouoffice.com/login' },
    { id: 'erp', label: '영림원', icon: Layers, external: 'https://mfg.systemevererp.com/' },
    { id: 'mes', label: 'EK MES', icon: Activity, external: 'http://192.168.56.206/MES/login.do' },
    { id: 'nas', label: 'EK파일서버', icon: Folder, external: '\\\\192.168.63.253' },
  ];

  const renderButton = (item: any) => (
    <button
      key={item.id}
      onClick={() => {
        if (item.external) {
          if (item.id === 'nas') {
            try {
              navigator.clipboard.writeText(item.external);
              toast.info('파일서버 주소가 복사되었습니다. 파일 탐색기 주소창에 붙여넣으세요.', {
                description: item.external
              });
              window.open(`file:${item.external}`, '_blank');
            } catch (err) {
              window.open(`file:${item.external}`, '_blank');
            }
          } else {
            window.open(item.external, '_blank');
          }
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
  );

  return (
    <div className="w-52 bg-white/60 backdrop-blur-xl border-r border-slate-200/50 h-screen flex flex-col relative z-20">
      <div className="p-6 font-bold text-xl text-blue-600">EK 생산기술팀</div>
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto pb-6">
        <div className="space-y-1">
          {mainItems.map(renderButton)}
        </div>

        <div className="my-4 px-2">
          <div className="h-px bg-slate-200/60 w-full" />
        </div>

        <div className="space-y-1">
          <div className="px-4 mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">핵심 업무 시스템</span>
          </div>
          <div className="bg-slate-50/50 rounded-2xl p-1 border border-slate-100/50">
            {workItems.map(renderButton)}
          </div>
        </div>
      </nav>
      <div className="p-6 border-t border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 tracking-widest text-center">MADE BY EK JYH</p>
      </div>
    </div>
  );
};
