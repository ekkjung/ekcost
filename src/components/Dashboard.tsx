import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { CostItem } from '../types';
import { db, auth, doc, setDoc, onSnapshot, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { List, CheckCircle, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

interface DashboardProps {
  items: CostItem[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export const Dashboard: React.FC<DashboardProps> = ({ items }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch comment for selected year/month
  useEffect(() => {
    const commentId = `${year}_${month}`;
    const unsubscribe = onSnapshot(doc(db, 'dashboard_comments', commentId), (snapshot) => {
      if (snapshot.exists()) {
        setComment(snapshot.data().comment || '');
      } else {
        setComment('');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `dashboard_comments/${commentId}`);
    });

    return () => unsubscribe();
  }, [year, month]);

  const handleSaveComment = async () => {
    setIsSaving(true);
    const commentId = `${year}_${month}`;
    try {
      await setDoc(doc(db, 'dashboard_comments', commentId), {
        id: commentId,
        year,
        month,
        comment,
        updatedAt: new Date().toISOString(),
        uid: auth.currentUser?.uid || 'anonymous'
      });
      toast.success(`${year}년 ${month}월 코멘트가 저장되었습니다.`);
    } catch (error) {
      toast.error('코멘트 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchYear = year === 0 || item.year === year;
      const matchMonth = month === 0 || item.month === month;
      return matchYear && matchMonth;
    });
  }, [items, year, month]);

  const usageStats = useMemo(() => {
    const usageItems = filteredItems.filter(i => !i.isPlanned);
    const included = usageItems.filter(i => i.isIncludedInPlan).length;
    const excluded = usageItems.filter(i => !i.isIncludedInPlan).length;
    return { included, excluded, total: usageItems.length };
  }, [filteredItems]);

  const plannedVsActual = useMemo(() => {
    const planned = filteredItems.filter(i => i.isPlanned).reduce((sum, i) => sum + i.totalAmount, 0);
    const actual = filteredItems.filter(i => !i.isPlanned).reduce((sum, i) => sum + i.totalAmount, 0);
    return [
      { name: '계획', value: planned, color: '#3B82F6' },
      { name: '실제', value: actual, color: '#94A3B8' }
    ];
  }, [filteredItems]);

  const categoryData = useMemo(() => {
    const categories = ['수선비', '소모품비', '기타경비', '공정', '설비', '인건비', '재료비', '기타'];
    return categories.map(cat => {
      const planned = filteredItems.filter(i => i.isPlanned && i.category === cat).reduce((sum, i) => sum + i.totalAmount, 0);
      const actual = filteredItems.filter(i => !i.isPlanned && i.category === cat).reduce((sum, i) => sum + i.totalAmount, 0);
      return { name: cat, 계획: planned, 실제: actual };
    }).filter(d => d.계획 > 0 || d.실제 > 0);
  }, [filteredItems]);

  const processComparisonData = useMemo(() => {
    // Extract unique process names, trimming whitespace and handling empty strings
    const processes = Array.from(new Set(filteredItems.map(i => {
      const name = i.processName?.trim();
      return name && name.length > 0 ? name : '기타/미지정';
    })));
    
    return processes.map(proc => {
      const planned = filteredItems
        .filter(i => i.isPlanned && (i.processName?.trim() || '기타/미지정') === proc)
        .reduce((sum, i) => sum + i.totalAmount, 0);
        
      const actual = filteredItems
        .filter(i => !i.isPlanned && (i.processName?.trim() || '기타/미지정') === proc)
        .reduce((sum, i) => sum + i.totalAmount, 0);
      
      let chartData;
      if (actual <= planned) {
        chartData = [
          { name: '집행금액', value: actual, color: '#3B82F6' },
          { name: '잔여예산', value: Math.max(0, planned - actual), color: '#F1F5F9' }
        ];
      } else {
        chartData = [
          { name: '계획예산', value: planned, color: '#3B82F6' },
          { name: '초과금액', value: actual - planned, color: '#EF4444' }
        ];
      }

      return { 
        name: proc, 
        data: chartData,
        planned,
        actual
      };
    }).filter(d => d.planned > 0 || d.actual > 0)
      .sort((a, b) => b.actual - a.actual);
  }, [filteredItems]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR').format(value);

  return (
    <div className="p-8 space-y-8 bg-transparent min-h-screen relative z-10">
      <div className="flex justify-between items-center bg-white/60 backdrop-blur-md p-6 rounded-[32px] shadow-sm border border-white/50">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">비용 분석 데시보드</h2>
          <p className="text-sm text-slate-400 mt-1">월별 계획 대비 실제 사용 현황을 분석합니다.</p>
        </div>
        <div className="flex gap-3">
          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))} 
            className="bg-slate-50/50 border-none rounded-2xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
          >
            <option value={0}>전체 년도</option>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))} 
            className="bg-slate-50/50 border-none rounded-2xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
          >
            <option value={0}>전체 월</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-[32px] border border-white/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <List className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold">전체 사용 건수</p>
            <p className="text-2xl font-bold text-slate-900">{usageStats.total}건</p>
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-[32px] border border-white/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold">계획 내 사용 (포함)</p>
            <p className="text-2xl font-bold text-slate-900">{usageStats.included}건</p>
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-[32px] border border-white/50 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-bold">계획 외 사용 (미포함)</p>
            <p className="text-2xl font-bold text-slate-900">{usageStats.excluded}건</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/60 backdrop-blur-md p-8 rounded-[32px] border border-white/50 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-slate-800">전체 계획 대비 실제</h3>
            <div className="flex gap-4 text-xs font-bold">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#3B82F6]"></div>계획</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#94A3B8]"></div>실제</div>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plannedVsActual} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `${(val / 10000).toLocaleString()}만`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${formatCurrency(value)}원`, '']}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                  {plannedVsActual.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md p-8 rounded-[32px] border border-white/50 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-slate-800">항목별 상세 비교</h3>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${(val / 10000).toLocaleString()}만`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${formatCurrency(value)}원`, '']}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 600 }} />
                <Bar dataKey="계획" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="실제" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 px-2">
          <h3 className="text-lg font-bold text-slate-800">공정별 예산 대비 사용 현황</h3>
          <span className="text-xs text-slate-400 font-medium">(공정별 개별 분석)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {processComparisonData.map((proc) => (
            <div key={proc.name} className="bg-white/60 backdrop-blur-md p-6 rounded-[32px] border border-white/50 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-sm font-bold text-slate-800 truncate max-w-[150px]" title={proc.name}>{proc.name}</h4>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-bold",
                  proc.actual > proc.planned ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                )}>
                  {proc.planned > 0 ? `${((proc.actual / proc.planned) * 100).toFixed(0)}%` : '-%'}
                </span>
              </div>
              <div className="h-[160px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={proc.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {proc.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                      formatter={(value: number) => [`${formatCurrency(value)}원`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">사용률</span>
                  <span className={cn(
                    "text-sm font-bold",
                    proc.actual > proc.planned ? "text-rose-500" : "text-slate-700"
                  )}>
                    {proc.planned > 0 ? `${((proc.actual / proc.planned) * 100).toFixed(0)}%` : '0%'}
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">계획 예산</span>
                  <span className="text-slate-700 font-bold">{formatCurrency(proc.planned)}원</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">실제 집행</span>
                  <span className={cn("font-bold", proc.actual > proc.planned ? "text-rose-500" : "text-slate-700")}>
                    {formatCurrency(proc.actual)}원
                  </span>
                </div>
                <div className="pt-1.5 mt-1.5 border-t border-slate-100 flex justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">잔여/초과</span>
                  <span className={cn("font-bold", proc.actual > proc.planned ? "text-rose-500" : "text-emerald-500")}>
                    {formatCurrency(proc.planned - proc.actual)}원
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-md p-8 rounded-[32px] border border-white/50 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">초과 사유 및 분석 코멘트</h3>
            <p className="text-sm text-slate-400 mt-1">
              {year === 0 ? '전체 년도' : `${year}년`} {month === 0 ? '전체 월' : `${month}월`} 분석 내용입니다.
            </p>
          </div>
          <button 
            onClick={handleSaveComment}
            disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '코멘트 저장'}
          </button>
        </div>
        <textarea 
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full h-40 p-6 bg-slate-50/50 border-none rounded-3xl text-sm focus:ring-2 focus:ring-blue-100 outline-none resize-none transition-all"
          placeholder="계획 대비 사용금액이 초과되었다면 이유를 입력하거나 월별 분석 내용을 기록해주세요."
        />
      </div>
    </div>
  );
};
