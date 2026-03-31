import React from 'react';
import { CostItem } from '../types';
import { List, ArrowUpDown, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface LedgerPageProps {
  items: CostItem[];
  formatCurrency: (value: number) => string;
  onDeleteItem: (id: string) => void;
  onEditItem: (item: CostItem) => void;
  requestSort: (key: keyof CostItem) => void;
}

export const LedgerPage: React.FC<LedgerPageProps> = ({ items, formatCurrency, onDeleteItem, onEditItem, requestSort }) => {
  return (
    <div className="p-8">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <List className="w-5 h-5 text-blue-500" />
            거래 원장
          </h2>
          <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
            {items.length}개 기록
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-blue-500 transition-colors" onClick={() => requestSort('year')}>
                  날짜 <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">계획 여부</th>
                <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-blue-500 transition-colors" onClick={() => requestSort('category')}>
                  계정항목 <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">공정/설비</th>
                <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-blue-500 transition-colors" onClick={() => requestSort('itemName')}>
                  항목 <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">수량</th>
                <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right cursor-pointer hover:text-blue-500 transition-colors" onClick={() => requestSort('unitPrice')}>
                  단가 <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th className="p-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right cursor-pointer hover:text-blue-500 transition-colors" onClick={() => requestSort('totalAmount')}>
                  합계 <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th className="p-6 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => (
                <tr 
                  key={item.id} 
                  onClick={() => onEditItem(item)}
                  className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                >
                  <td className="p-6 text-xs font-bold text-slate-500 font-mono">
                    {item.year}.{String(item.month).padStart(2, '0')}.{String(item.day).padStart(2, '0')}
                  </td>
                  <td className="p-6">
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                      item.isPlanned ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                    )}>
                      {item.isPlanned ? '계획됨' : '계획외'}
                    </span>
                  </td>
                  <td className="p-6">
                    <span className="text-[10px] px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold uppercase tracking-tight">{item.category}</span>
                  </td>
                  <td className="p-6">
                    <div className="text-xs font-semibold text-[#1E293B]">{item.processName || '-'}</div>
                    <div className="text-[10px] text-slate-400">{item.equipmentName || '-'}</div>
                  </td>
                  <td className="p-6">
                    <div className="text-sm font-bold text-[#0F172A] item-name">{item.itemName}</div>
                    <div className="text-[10px] text-slate-400">{item.itemNumber || '-'}</div>
                  </td>
                  <td className="p-6 text-right text-xs font-mono text-slate-500">{item.quantity}</td>
                  <td className="p-6 text-right text-xs font-mono">{formatCurrency(item.unitPrice)}</td>
                  <td className="p-6 text-right text-xs font-mono font-bold text-[#0F172A]">{formatCurrency(item.totalAmount)}</td>
                  <td className="p-6 text-right print:hidden">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('이 항목을 삭제하시겠습니까?')) {
                          onDeleteItem(item.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
