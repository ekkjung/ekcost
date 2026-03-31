import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CostItem } from '../types';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface HomeProps {
  items: CostItem[];
  formatCurrency: (value: number) => string;
}

export const Home: React.FC<HomeProps> = ({ items, formatCurrency }) => {
  const currentYear = new Date().getFullYear();

  const stats = useMemo(() => {
    const planned = items.filter(i => i.isPlanned && i.year === currentYear).reduce((sum, i) => sum + i.totalAmount, 0);
    const actual = items.filter(i => !i.isPlanned && i.year === currentYear).reduce((sum, i) => sum + i.totalAmount, 0);
    return {
      planned,
      actual,
      remaining: planned - actual
    };
  }, [items, currentYear]);

  const yearlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const planned = items.filter(item => item.isPlanned && item.year === currentYear && item.month === month).reduce((sum, item) => sum + item.totalAmount, 0);
      const actual = items.filter(item => !item.isPlanned && item.year === currentYear && item.month === month).reduce((sum, item) => sum + item.totalAmount, 0);
      return {
        name: `${month}월`,
        계획: planned,
        실제: actual
      };
    });
  }, [items, currentYear]);

  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold">총 예산 (계획)</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.planned)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold">총 사용액 (실제)</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.actual)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold">현재 남은 금액</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.remaining)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold mb-6">년간 예산 대비 사용량</h3>
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
              <Bar dataKey="계획" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="실제" fill="#94A3B8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
