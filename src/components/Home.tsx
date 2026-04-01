import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { CostItem } from '../types';
import { TrendingUp, TrendingDown, Wallet, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

interface HomeProps {
  items: CostItem[];
  formatCurrency: (value: number) => string;
}

export const Home: React.FC<HomeProps> = ({ items, formatCurrency }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(0); // 0 for All

  const stats = useMemo(() => {
    const filtered = items.filter(i => {
      const matchYear = year === 0 || i.year === year;
      const matchMonth = month === 0 || i.month === month;
      return matchYear && matchMonth;
    });

    const planned = filtered.filter(i => i.isPlanned).reduce((sum, i) => sum + i.totalAmount, 0);
    const actual = filtered.filter(i => !i.isPlanned).reduce((sum, i) => sum + i.totalAmount, 0);
    const remaining = planned - actual;
    const percentage = planned > 0 ? (remaining / planned) * 100 : 0;
    
    return {
      planned,
      actual,
      remaining,
      percentage
    };
  }, [items, year, month]);

  const yearlyData = useMemo(() => {
    if (month !== 0) {
      // If a specific month is selected, show data for that month only or maybe compare with previous/next?
      // Let's keep showing 12 months but for the selected year.
      // If year is 0, this might be huge.
      // Usually yearlyData is for a specific year.
    }
    
    const targetYear = year === 0 ? new Date().getFullYear() : year;

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const planned = items.filter(item => item.isPlanned && item.year === targetYear && item.month === m).reduce((sum, item) => sum + item.totalAmount, 0);
      const actual = items.filter(item => !item.isPlanned && item.year === targetYear && item.month === m).reduce((sum, item) => sum + item.totalAmount, 0);
      return {
        name: `${m}월`,
        계획: planned,
        실제: actual
      };
    });
  }, [items, year]);

  return (
    <div className="p-8 space-y-8 relative z-10">
      <div className="flex justify-between items-center bg-white/60 backdrop-blur-md p-6 rounded-[32px] shadow-sm border border-white/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">현황 요약</h2>
            <p className="text-xs text-slate-400">선택한 기간의 예산 집행 현황입니다.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))} 
            className="bg-slate-50 border-none rounded-2xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
          >
            <option value={0}>전체 년도</option>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))} 
            className="bg-slate-50 border-none rounded-2xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
          >
            <option value={0}>전체 월</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-white/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold">총 예산 (계획)</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.planned)}</p>
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-white/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold">총 사용액 (실제)</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.actual)}</p>
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-white/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold">현재 남은 금액</p>
            <div className="flex items-baseline gap-2">
              <p className={cn(
                "text-2xl font-bold",
                stats.remaining >= 0 ? "text-slate-900" : "text-rose-600"
              )}>
                {formatCurrency(stats.remaining)}
              </p>
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full",
                stats.percentage >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              )}>
                {stats.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-md p-8 rounded-3xl border border-white/50 shadow-sm">
        <h3 className="text-lg font-bold mb-6">
          {year === 0 ? '년간' : `${year}년`} 예산 대비 사용량
        </h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `${(value / 10000).toLocaleString()}만`} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
              <Bar dataKey="계획" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                <LabelList 
                  dataKey="계획" 
                  position="top" 
                  formatter={(value: number) => value > 0 ? `${(value / 10000).toLocaleString()}만` : ''}
                  style={{ fontSize: '10px', fontWeight: '700', fill: '#3B82F6' }}
                />
              </Bar>
              <Bar dataKey="실제" fill="#94A3B8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
