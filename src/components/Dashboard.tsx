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

const ProcessCard: React.FC<{ proc: any, formatCurrency: (v: number) => string }> = ({ proc, formatCurrency }) => (
  <div className={cn(
    "p-6 rounded-[32px] border shadow-sm flex flex-col hover:shadow-md transition-all duration-300 group backdrop-blur-xl",
    proc.name === '수선비' ? "bg-slate-900/[0.07] border-slate-200/60" : 
    proc.name === '소모품비' ? "bg-rose-500/[0.07] border-rose-200/60" : 
    "bg-white/60 border-white/50"
  )}>
    <div className="flex justify-between items-start mb-2">
      <div className="flex flex-col">
        <span className="text-[14px] font-black text-slate-800 leading-tight">{proc.processName}</span>
        <span className="text-[11px] font-bold text-slate-500 leading-tight">{proc.name}</span>
      </div>
      <span className={cn(
        "text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0",
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
            innerRadius={48}
            outerRadius={68}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {proc.data.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
            formatter={(value: number) => [`${formatCurrency(value)}원`, '']}
          />
        </PieChart>
      </ResponsiveContainer>
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
);

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

  const groupedProcessData = useMemo(() => {
    const models = ['SIM', 'SCM', 'IPM'];
    const result: Record<string, Record<string, any[]>> = { 
      SIM: {}, 
      SCM: {}, 
      IPM: {}, 
      OTHERS: {} 
    };

    // Let's do a cleaner aggregation
    const aggregation: any = {};
    
    filteredItems.forEach(item => {
      const m = item.processModel?.toUpperCase().trim() || '기타';
      const p = item.processName?.trim() || '기타/미지정';
      const c = item.category;
      const key = `${m}|${p}|${c}`;
      
      if (!aggregation[key]) {
        aggregation[key] = {
          model: m,
          process: p,
          category: c,
          planned: 0,
          actual: 0
        };
      }
      
      if (item.isPlanned) {
        aggregation[key].planned += item.totalAmount;
      } else {
        aggregation[key].actual += item.totalAmount;
      }
    });

    Object.values(aggregation).forEach((group: any) => {
      if (group.planned === 0 && group.actual === 0) return;
      
      const modelKey = models.includes(group.model) ? group.model : 'OTHERS';
      
      if (!result[modelKey][group.process]) {
        result[modelKey][group.process] = [];
      }
      
      let chartData;
      const isRepair = group.category === '수선비';
      const isConsumable = group.category === '소모품비';
      
      const baseColor = isRepair ? '#475569' : isConsumable ? '#E11D48' : '#3B82F6';
      const bgColor = isRepair ? '#E2E8F0' : isConsumable ? '#FFE4E6' : '#F1F5F9';

      if (group.actual <= group.planned) {
        chartData = [
          { name: '집행금액', value: group.actual, color: baseColor },
          { name: '잔여예산', value: Math.max(0, group.planned - group.actual), color: bgColor }
        ];
      } else {
        chartData = [
          { name: '계획예산', value: group.planned, color: baseColor },
          { name: '초과금액', value: group.actual - group.planned, color: '#EF4444' }
        ];
      }

      result[modelKey][group.process].push({
        name: group.category,
        data: chartData,
        planned: group.planned,
        actual: group.actual,
        model: group.model,
        processName: group.process,
        category: group.category
      });
    });

    // Sort categories within each process by actual amount
    Object.keys(result).forEach(mKey => {
      Object.keys(result[mKey]).forEach(pKey => {
        result[mKey][pKey].sort((a, b) => b.actual - a.actual);
      });
    });

    return result;
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

      <div className="space-y-16">
        {/* SIM Group */}
        {Object.keys(groupedProcessData.SIM).length > 0 && (
          <div className="space-y-10">
            <div className="flex items-center gap-3 px-2 border-l-4 border-blue-600 pl-4">
              <h3 className="text-xl font-black text-blue-600">SIM 공정모델 현황</h3>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Process Model: SIM</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {(Object.entries(groupedProcessData.SIM) as [string, any[]][]).flatMap(([procName, categories]) => 
                categories.map((catData, idx) => (
                  <ProcessCard key={`${procName}-${idx}`} proc={catData} formatCurrency={formatCurrency} />
                ))
              )}
            </div>
          </div>
        )}

        {/* SCM Group */}
        {Object.keys(groupedProcessData.SCM).length > 0 && (
          <div className="space-y-10">
            <div className="flex items-center gap-3 px-2 border-l-4 border-emerald-600 pl-4">
              <h3 className="text-xl font-black text-emerald-600">SCM 공정모델 현황</h3>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Process Model: SCM</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {(Object.entries(groupedProcessData.SCM) as [string, any[]][]).flatMap(([procName, categories]) => 
                categories.map((catData, idx) => (
                  <ProcessCard key={`${procName}-${idx}`} proc={catData} formatCurrency={formatCurrency} />
                ))
              )}
            </div>
          </div>
        )}

        {/* IPM Group */}
        {Object.keys(groupedProcessData.IPM).length > 0 && (
          <div className="space-y-10">
            <div className="flex items-center gap-3 px-2 border-l-4 border-amber-600 pl-4">
              <h3 className="text-xl font-black text-amber-600">IPM 공정모델 현황</h3>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Process Model: IPM</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {(Object.entries(groupedProcessData.IPM) as [string, any[]][]).flatMap(([procName, categories]) => 
                categories.map((catData, idx) => (
                  <ProcessCard key={`${procName}-${idx}`} proc={catData} formatCurrency={formatCurrency} />
                ))
              )}
            </div>
          </div>
        )}

        {/* Others Group */}
        {Object.keys(groupedProcessData.OTHERS).length > 0 && (
          <div className="space-y-10">
            <div className="flex items-center gap-3 px-2 border-l-4 border-slate-600 pl-4">
              <h3 className="text-xl font-black text-slate-600">기타 공정모델 현황</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {(Object.entries(groupedProcessData.OTHERS) as [string, any[]][]).flatMap(([procName, categories]) => 
                categories.map((catData, idx) => (
                  <ProcessCard key={`${procName}-${idx}`} proc={catData} formatCurrency={formatCurrency} />
                ))
              )}
            </div>
          </div>
        )}
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
