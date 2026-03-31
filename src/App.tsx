/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, ErrorInfo, ReactNode } from 'react';
import { Toaster, toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  ArrowUpDown, 
  LayoutDashboard,
  List,
  Search,
  Printer,
  Cpu,
  Layers,
  Activity,
  X,
  FileDown,
  FileUp,
  ArrowLeft,
  Edit2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CostItem, CostCategory } from './types';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  handleFirestoreError,
  OperationType,
  writeBatch
} from './firebase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary
class ErrorBoundary extends React.Component<any, any> {
  state: any;
  props: any;

  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "문제가 발생했습니다.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "{}");
        if (parsed.error) errorMessage = `Firebase 오류: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">애플리케이션 오류</h2>
            <p className="text-slate-500 text-sm mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              애플리케이션 다시 로드
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const CATEGORIES: CostCategory[] = ['공정', '설비', '인건비', '재료비', '기타'];
const YEARS = [2024, 2025, 2026, 2027];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function AppContent() {
  const [items, setItems] = useState<CostItem[]>([]);
  const [fullScreenView, setFullScreenView] = useState<'none' | 'plan' | 'usage'>('none');

  const [filterYear, setFilterYear] = useState<number | 'all'>(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<CostCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof CostItem, direction: 'asc' | 'desc' } | null>({ key: 'year', direction: 'desc' });

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<CostItem>>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    category: '공정',
    itemName: '',
    processModel: '',
    processName: '',
    equipmentName: '',
    itemNumber: '',
    supplier: '',
    manufacturer: '',
    quantity: 1,
    unitPrice: 0,
    totalAmount: 0,
    isPlanned: true,
  });

  useEffect(() => {
    const q = query(collection(db, 'costs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CostItem));
      setItems(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'costs');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setNewItem(prev => ({
      ...prev,
      totalAmount: (prev.quantity || 0) * (prev.unitPrice || 0)
    }));
  }, [newItem.quantity, newItem.unitPrice]);

  useEffect(() => {
    if (newItem.isPlanned) {
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      const targetYear = [1, 2, 3].includes(newItem.month || 0) ? nextYear : currentYear;
      
      if (newItem.year !== targetYear) {
        setNewItem(prev => ({ ...prev, year: targetYear }));
      }
    }
  }, [newItem.isPlanned, newItem.month]);

  const isAdmin = true;

  const handleMigrateData = async () => {
    if (!isAdmin) return;
    if (!window.confirm('1월~3월 데이터를 모두 2027년으로 변경하시겠습니까?')) return;
    
    const batch = writeBatch(db);
    let count = 0;
    items.forEach(item => {
      if ([1, 2, 3].includes(item.month) && item.year !== 2027) {
        const docRef = doc(db, 'costs', item.id);
        batch.update(docRef, { year: 2027 });
        count++;
      }
    });
    
    if (count > 0) {
      try {
        await batch.commit();
        toast.success(`${count}개의 데이터가 2027년으로 업데이트되었습니다.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'costs');
      }
    } else {
      toast.info('업데이트할 데이터가 없습니다.');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const path = 'costs';
    
    const savePromise = async () => {
      if (editingId) {
        const docRef = doc(db, path, editingId);
        const updatedItem = {
          ...newItem,
          id: editingId,
        } as CostItem;
        await setDoc(docRef, updatedItem, { merge: true });
      } else {
        const id = crypto.randomUUID();
        const docRef = doc(db, path, id);
        const item: CostItem = {
          id,
          year: newItem.year!,
          month: newItem.month!,
          day: newItem.day!,
          category: newItem.category as CostCategory,
          itemName: newItem.itemName!,
          processModel: newItem.processModel || '',
          processName: newItem.processName || '',
          equipmentName: newItem.equipmentName || '',
          itemNumber: newItem.itemNumber || '',
          supplier: newItem.supplier || '',
          manufacturer: newItem.manufacturer || '',
          quantity: newItem.quantity!,
          unitPrice: newItem.unitPrice!,
          totalAmount: newItem.totalAmount!,
          isPlanned: newItem.isPlanned!,
          createdAt: new Date().toISOString(),
        };
        await setDoc(docRef, item);
      }
    };

    toast.promise(savePromise(), {
      loading: '저장 중...',
      success: () => {
        setIsAdding(false);
        setEditingId(null);
        
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        setNewItem({
          year: currentYear,
          month: currentMonth,
          day: new Date().getDate(),
          category: '공정',
          itemName: '',
          processModel: '',
          processName: '',
          equipmentName: '',
          itemNumber: '',
          supplier: '',
          manufacturer: '',
          quantity: 1,
          unitPrice: 0,
          totalAmount: 0,
          isPlanned: true,
        });
        return '성공적으로 저장되었습니다.';
      },
      error: (error) => {
        handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, path);
        return '저장 중 오류가 발생했습니다.';
      }
    });
  };

  const handleEdit = (item: CostItem) => {
    setNewItem({
      year: item.year,
      month: item.month,
      day: item.day,
      category: item.category,
      itemName: item.itemName,
      processModel: item.processModel || '',
      processName: item.processName || '',
      equipmentName: item.equipmentName || '',
      itemNumber: item.itemNumber || '',
      supplier: item.supplier || '',
      manufacturer: item.manufacturer || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalAmount: item.totalAmount,
      isPlanned: item.isPlanned,
    });
    setEditingId(item.id);
    setIsAdding(true);
  };

  const handleAddNew = (isPlanned: boolean = false) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    let initialYear = currentYear;
    
    if (isPlanned && [1, 2, 3].includes(currentMonth)) {
      initialYear = currentYear + 1;
    }

    setNewItem({
      year: initialYear,
      month: currentMonth,
      day: new Date().getDate(),
      category: '공정',
      itemName: '',
      processModel: '',
      processName: '',
      equipmentName: '',
      itemNumber: '',
      supplier: '',
      manufacturer: '',
      quantity: 1,
      unitPrice: 0,
      totalAmount: 0,
      isPlanned: isPlanned,
    });
    setEditingId(null);
    setIsAdding(true);
  };

  const deleteItem = async (id: string) => {
    const path = 'costs';
    const deletePromise = deleteDoc(doc(db, path, id));
    
    toast.promise(deletePromise, {
      loading: '삭제 중...',
      success: '항목이 성공적으로 삭제되었습니다.',
      error: (err) => {
        handleFirestoreError(err, OperationType.DELETE, path);
        return '삭제 중 오류가 발생했습니다.';
      }
    });
  };

  const startEdit = (item: CostItem) => {
    setNewItem(item);
    setEditingId(item.id);
    setIsAdding(true);
  };

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const matchYear = filterYear === 'all' || item.year === filterYear;
      const matchMonth = filterMonth === 'all' || item.month === filterMonth;
      const matchCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchYear && matchMonth && matchCategory && matchSearch;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [items, filterYear, filterMonth, filterCategory, searchTerm, sortConfig]);

  const stats = useMemo(() => {
    const totalPlanned = filteredItems.filter(i => i.isPlanned).reduce((sum, item) => sum + item.totalAmount, 0);
    const totalActual = filteredItems.filter(i => !i.isPlanned).reduce((sum, item) => sum + item.totalAmount, 0);
    const diff = totalPlanned - totalActual;
    const diffPercent = totalPlanned === 0 ? 0 : (diff / totalPlanned) * 100;

    return { totalPlanned, totalActual, diff, diffPercent };
  }, [filteredItems]);

  const chartData = useMemo(() => {
    const monthlyData: Record<string, { planned: number, actual: number }> = {};
    
    if (filterYear !== 'all') {
      MONTHS.forEach(m => {
        monthlyData[`${m}월`] = { planned: 0, actual: 0 };
      });
    }

    items.forEach(item => {
      if (filterYear === 'all' || item.year === filterYear) {
        const key = filterYear === 'all' ? `${item.year}년 ${item.month}월` : `${item.month}월`;
        if (!monthlyData[key]) monthlyData[key] = { planned: 0, actual: 0 };
        if (item.isPlanned) {
          monthlyData[key].planned += item.totalAmount;
        } else {
          monthlyData[key].actual += item.totalAmount;
        }
      }
    });

    return Object.entries(monthlyData).map(([name, data]) => ({
      name,
      ...data
    }));
  }, [items, filterYear]);

  const requestSort = (key: keyof CostItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans selection:bg-[#3B82F6] selection:text-white">
      {/* Print-only Header */}
      <div className="hidden print:block mb-8 border-b-2 border-[#3B82F6] pb-4">
        <h1 className="text-3xl font-bold text-[#1E293B]">월간 비용 보고서</h1>
        <p className="text-sm text-[#64748B] mt-1">생성일: {new Date().toLocaleDateString()} | 반도체 부문</p>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200">
            <p className="text-[10px] uppercase font-bold text-slate-500">총 계획 예산</p>
            <p className="text-xl font-mono">{formatCurrency(stats.totalPlanned)}</p>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200">
            <p className="text-[10px] uppercase font-bold text-slate-500">총 실제 지출</p>
            <p className="text-xl font-mono">{formatCurrency(stats.totalActual)}</p>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200">
            <p className="text-[10px] uppercase font-bold text-slate-500">예산 차이</p>
            <p className="text-xl font-mono">{formatCurrency(stats.diff)}</p>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="print:hidden border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#3B82F6] rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Cpu className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">
                EK 생산기술팀 연간 예산 사용현황
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">반도체 원장</p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button 
                onClick={() => setFullScreenView('plan')}
                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all border border-blue-100"
              >
                계획
              </button>
              <button 
                onClick={() => setFullScreenView('usage')}
                className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all border border-slate-200"
              >
                사용
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handlePrint}
              className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
              title="보고서 인쇄"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button 
              onClick={() => handleAddNew(false)}
              className="bg-[#0F172A] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold hover:bg-black transition-all shadow-xl shadow-slate-200"
            >
              <Plus className="w-4 h-4" />
              새 기록 추가
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats Section */}
        <section className="print:hidden grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: '계획 예산', value: stats.totalPlanned, icon: Layers, color: 'blue' },
            { label: '실제 지출', value: stats.totalActual, icon: Activity, color: 'slate' },
            { label: '예산 차이', value: stats.diff, icon: TrendingUp, color: stats.diff >= 0 ? 'emerald' : 'rose' }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className={cn(
                  "p-2 rounded-lg",
                  stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                  stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                  stat.color === 'rose' ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-600"
                )}>
                  <stat.icon className="w-5 h-5" />
                </div>
                {stat.label === '예산 차이' && (
                  <span className={cn(
                    "text-xs font-bold px-2 py-1 rounded-full",
                    stats.diff >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  )}>
                    {stats.diff >= 0 ? '+' : ''}{stats.diffPercent.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-[#0F172A] mt-1 font-mono">{formatCurrency(stat.value)}</p>
            </div>
          ))}
        </section>

        {/* Filters & Chart */}
        <div className="print:hidden grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Chart */}
          <div className="lg:col-span-3 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-lg font-bold text-[#0F172A]">월간 실적</h2>
              <select 
                value={filterYear} 
                onChange={(e) => setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="text-xs font-bold border-none bg-slate-50 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-100 outline-none"
              >
                <option value="all">전체 연도</option>
                {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#94A3B8' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#94A3B8' }}
                    tickFormatter={(val) => `${(val / 10000).toFixed(0)}만`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }}
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: 'none',
                      borderRadius: '16px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontFamily: 'inherit',
                      fontSize: '12px'
                    }} 
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} />
                  <Bar dataKey="planned" name="계획" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={32} />
                  <Bar dataKey="actual" name="실제" fill="#94A3B8" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sidebar Filters */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-500" />
                빠른 검색
              </h3>
              <input 
                type="text" 
                placeholder="항목 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-500" />
                데이터 필터링
              </h3>
              <div className="space-y-3">
                <select 
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="all">전체 월</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
                </select>
                <select 
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value as any)}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="all">전체 계정항목</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <button 
              onClick={() => {
                setFilterYear(new Date().getFullYear());
                setFilterMonth('all');
                setFilterCategory('all');
                setSearchTerm('');
              }}
              className="w-full text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors uppercase tracking-widest"
            >
              모든 필터 초기화
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <List className="w-5 h-5 text-blue-500" />
              거래 원장
            </h2>
            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
              {filteredItems.length}개 기록
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
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-20 text-center text-slate-300 font-medium italic">거래 내역이 없습니다.</td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr 
                      key={item.id} 
                      onClick={() => startEdit(item)}
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
                              deleteItem(item.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="print:hidden p-12 border-t border-slate-100 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <Cpu className="text-blue-500 w-5 h-5" />
            <span className="text-sm font-bold text-slate-400">코스트코어 v2.0 | 반도체 부문</span>
          </div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
            <span>보안 프로토콜 활성</span>
            <span>데이터 암호화됨</span>
          </div>
        </div>
      </footer>

      {/* Full Screen List View Overlay */}
      {fullScreenView !== 'none' && (
        <FullScreenListView 
          type={fullScreenView} 
          items={items} 
          onClose={() => setFullScreenView('none')} 
          formatCurrency={formatCurrency}
          onDeleteItem={deleteItem}
          onEditItem={handleEdit}
          onAddNew={() => handleAddNew(fullScreenView === 'plan')}
          onCompleteUse={async (item) => {
            const newDocRef = doc(collection(db, 'costs'));
            try {
              const newItem = {
                ...item,
                id: newDocRef.id,
                isPlanned: false,
                createdAt: new Date().toISOString()
              };
              await setDoc(newDocRef, newItem);
              toast.success('사용 리스트로 복사되었습니다.');
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, 'costs');
            }
          }}
          onRestorePlan={async (item) => {
            const newDocRef = doc(collection(db, 'costs'));
            try {
              const newItem = {
                ...item,
                id: newDocRef.id,
                isPlanned: true,
                createdAt: new Date().toISOString()
              };
              await setDoc(newDocRef, newItem);
              toast.success('계획 리스트로 복사되었습니다.');
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, 'costs');
            }
          }}
        />
      )}

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white rounded-[32px] w-full max-w-2xl p-10 shadow-2xl animate-in fade-in zoom-in duration-300 my-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A]">{editingId ? '거래 수정' : '새 거래 추가'}</h2>
                <p className="text-sm text-slate-400 mt-1">반도체 제조 비용 상세 정보를 입력하세요.</p>
              </div>
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">연도</label>
                  <select 
                    value={newItem.year}
                    onChange={(e) => setNewItem({ ...newItem, year: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">월</label>
                  <select 
                    value={newItem.month}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      let y = newItem.year || new Date().getFullYear();
                      if (newItem.isPlanned && [1, 2, 3].includes(m)) {
                        y = new Date().getFullYear() + 1;
                      } else if (newItem.isPlanned) {
                        y = new Date().getFullYear();
                      }
                      setNewItem({ ...newItem, month: m, year: y });
                    }}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  >
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">일</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="31"
                    value={newItem.day}
                    onChange={(e) => setNewItem({ ...newItem, day: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">계정항목</label>
                  <select 
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value as any })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">당해년도 계획 포함 여부</label>
                  <div className="flex gap-4 p-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        checked={newItem.isPlanned === true}
                        onChange={() => setNewItem({ ...newItem, isPlanned: true })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm font-medium">예</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        checked={newItem.isPlanned === false}
                        onChange={() => setNewItem({ ...newItem, isPlanned: false })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm font-medium">아니오</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">공정 모델</label>
                  <input 
                    type="text" 
                    value={newItem.processModel}
                    onChange={(e) => setNewItem({ ...newItem, processModel: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="예: N7, N5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">공정명</label>
                  <input 
                    type="text" 
                    value={newItem.processName}
                    onChange={(e) => setNewItem({ ...newItem, processName: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="예: 포토공정"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">설비명</label>
                  <input 
                    type="text" 
                    value={newItem.equipmentName}
                    onChange={(e) => setNewItem({ ...newItem, equipmentName: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="예: ASML Twinscan"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">품명</label>
                  <input 
                    required
                    type="text" 
                    value={newItem.itemName}
                    onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                    placeholder="예: 웨이퍼 스테이지"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">품번</label>
                  <input 
                    type="text" 
                    value={newItem.itemNumber}
                    onChange={(e) => setNewItem({ ...newItem, itemNumber: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">구매처</label>
                  <input 
                    type="text" 
                    value={newItem.supplier}
                    onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">제조사</label>
                  <input 
                    type="text" 
                    value={newItem.manufacturer}
                    onChange={(e) => setNewItem({ ...newItem, manufacturer: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">수량</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">단가</label>
                  <input 
                    required
                    type="number" 
                    min="0"
                    value={newItem.unitPrice}
                    onChange={(e) => setNewItem({ ...newItem, unitPrice: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">총액</label>
                  <div className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm font-bold font-mono">
                    {formatCurrency(newItem.totalAmount || 0)}
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-[#3B82F6] text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-blue-100 mt-4"
              >
                {editingId ? '기록 수정' : '기록 확인'}
              </button>
            </form>
          </div>
        </div>
      )}
      <Toaster position="top-center" richColors />
    </div>
  );
}

interface FullScreenListViewProps {
  type: 'plan' | 'usage';
  items: CostItem[];
  onClose: () => void;
  formatCurrency: (value: number) => string;
  onDeleteItem: (id: string) => Promise<void>;
  onEditItem: (item: CostItem) => void;
  onAddNew: () => void;
  onCompleteUse: (item: CostItem) => Promise<void>;
  onRestorePlan: (item: CostItem) => Promise<void>;
}

function FullScreenListView({ type, items, onClose, formatCurrency, onDeleteItem, onEditItem, onAddNew, onCompleteUse, onRestorePlan }: FullScreenListViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof CostItem, direction: 'asc' | 'desc' } | null>({ key: 'year', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const matchType = type === 'plan' ? item.isPlanned === true : item.isPlanned === false;
      const matchSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.processName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.equipmentName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchMonth = selectedMonth === null || item.month === selectedMonth;
      return matchType && matchSearch && matchMonth;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.key === 'year') {
          const aDate = new Date(a.year, a.month - 1, a.day || 1).getTime();
          const bDate = new Date(b.year, b.month - 1, b.day || 1).getTime();
          return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
        }
        const aValue = a[sortConfig.key] ?? '';
        const bValue = b[sortConfig.key] ?? '';
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [items, type, searchTerm, sortConfig, selectedMonth]);

  const itemsPerPage = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig, type, selectedMonth]);

  const requestSort = (key: keyof CostItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDownloadExcel = () => {
    const dataToExport = filteredItems.map(item => ({
      '연도': item.year,
      '월': item.month,
      '일': item.day,
      '계정항목': item.category,
      '계획여부': item.isPlanned ? '계획' : '사용',
      '공정모델': item.processModel || '',
      '공정명': item.processName || '',
      '설비명': item.equipmentName || '',
      '품명': item.itemName,
      '품번': item.itemNumber || '',
      '구매처': item.supplier || '',
      '제조사': item.manufacturer || '',
      '수량': item.quantity,
      '단가': item.unitPrice,
      '합계': item.totalAmount
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, type === 'plan' ? '계획리스트' : '사용리스트');
    XLSX.writeFile(workbook, `EK_생산기술팀_${type === 'plan' ? '계획' : '사용'}_현황_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          alert("파일에 데이터가 없습니다.");
          setIsUploading(false);
          return;
        }

        // Update Firestore for each item
        const path = 'costs';
        let successCount = 0;
        
        for (const row of data) {
          try {
            const id = crypto.randomUUID();
            const docRef = doc(db, path, id);
            
            // Map Excel columns back to CostItem fields
            // Default isPlanned based on the current view if column is missing or empty
            const excelIsPlanned = row['계획여부'];
            const isPlanned = excelIsPlanned !== undefined 
              ? excelIsPlanned === '계획' 
              : type === 'plan';

            const item: CostItem = {
              id,
              year: Number(row['연도']) || new Date().getFullYear(),
              month: Number(row['월']) || new Date().getMonth() + 1,
              day: Number(row['일']) || new Date().getDate(),
              category: (row['계정항목'] as CostCategory) || (row['카테고리'] as CostCategory) || '기타',
              isPlanned: isPlanned,
              processModel: row['공정모델'] || '',
              processName: row['공정명'] || '',
              equipmentName: row['설비명'] || '',
              itemName: row['품명'] || '미지정',
              itemNumber: row['품번'] || '',
              supplier: row['구매처'] || '',
              manufacturer: row['제조사'] || '',
              quantity: Number(row['수량']) || 0,
              unitPrice: Number(row['단가']) || 0,
              totalAmount: (Number(row['수량']) || 0) * (Number(row['단가']) || 0),
              createdAt: new Date().toISOString()
            };
            
            await setDoc(docRef, item);
            successCount++;
          } catch (err) {
            console.error("Row upload failed", err, row);
          }
        }

        alert(`${successCount}개의 데이터가 성공적으로 업로드되었습니다.`);
      } catch (error) {
        console.error("Excel upload failed", error);
        alert("파일 업로드 중 오류가 발생했습니다. 포맷을 확인해주세요.");
      } finally {
        setIsUploading(false);
        // Reset input
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    const deletePromises = Array.from(selectedIds).map((id: string) => onDeleteItem(id));
    
    toast.promise(Promise.all(deletePromises), {
      loading: '일괄 삭제 중...',
      success: () => {
        setSelectedIds(new Set());
        return "선택한 항목이 모두 삭제되었습니다.";
      },
      error: "일부 항목 삭제 중 오류가 발생했습니다."
    });
  };

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-in slide-in-from-right duration-300">
      <header className="border-b border-slate-200 p-6 flex justify-between items-center bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-[#0F172A]">
            {type === 'plan' ? '계획 예산 상세 리스트' : '실제 사용 상세 리스트'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {type === 'plan' && (
            <button 
              onClick={onAddNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Plus className="w-4 h-4" />
              계획 추가
            </button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="리스트 내 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none w-64 transition-all"
            />
          </div>
          <button 
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all border border-emerald-100"
          >
            <FileDown className="w-4 h-4" />
            엑셀 다운로드
          </button>
          <label className={cn(
            "flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all border border-blue-100 cursor-pointer",
            isUploading && "opacity-50 cursor-not-allowed"
          )}>
            <FileUp className="w-4 h-4" />
            {isUploading ? '업로드 중...' : '엑셀 업로드'}
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={isUploading}
            />
          </label>
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all border border-rose-100"
            >
              <Trash2 className="w-4 h-4" />
              선택 삭제 ({selectedIds.size})
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-[1600px] mx-auto mb-8">
          <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <button
              onClick={() => setSelectedMonth(null)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                selectedMonth === null 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
            >
              전체
            </button>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  selectedMonth === month 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                )}
              >
                {month}월
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr>
                <th className="p-6 w-12">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                {[
                  { label: type === 'plan' ? '계획 월' : '날짜', key: 'year' },
                  { label: '계정항목', key: 'category' },
                  { label: '공정명', key: 'processName' },
                  { label: '설비명', key: 'equipmentName' },
                  { label: '품명', key: 'itemName' },
                  ...(type === 'plan' ? [] : [
                    { label: '품번', key: 'itemNumber' },
                    { label: '구매처', key: 'supplier' },
                    { label: '제조사', key: 'manufacturer' }
                  ]),
                  { label: '수량', key: 'quantity', align: 'right' },
                  { label: '단가', key: 'unitPrice', align: 'right' },
                  { label: '합계', key: 'totalAmount', align: 'right' }
                ].map((col) => (
                  <th 
                    key={col.key}
                    className={cn(
                      "p-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors",
                      col.align === 'right' && "text-right"
                    )}
                    onClick={() => requestSort(col.key as keyof CostItem)}
                  >
                    <div className={cn("flex items-center gap-1", col.align === 'right' && "justify-end")}>
                      {col.label}
                      {sortConfig?.key === col.key ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-32 text-center text-slate-300 font-medium italic">
                    표시할 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                currentItems.map((item) => (
                  <tr key={item.id} className={cn(
                    "hover:bg-slate-50/50 transition-colors group",
                    selectedIds.has(item.id) && "bg-blue-50/30"
                  )}>
                    <td className="p-3">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="p-3 text-xs font-bold text-slate-500 font-mono">
                      {type === 'plan' 
                        ? `${item.year}.${String(item.month).padStart(2, '0')}`
                        : `${item.year}.${String(item.month).padStart(2, '0')}.${String(item.day).padStart(2, '0')}`
                      }
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-bold uppercase">{item.category}</span>
                    </td>
                    <td className="p-3 text-xs font-semibold text-slate-700">{item.processName || '-'}</td>
                    <td className="p-3 text-xs text-slate-500">{item.equipmentName || '-'}</td>
                    <td className="p-3">
                      <div className="text-sm font-bold text-slate-900 item-name">{item.itemName}</div>
                    </td>
                    {type !== 'plan' && (
                      <>
                        <td className="p-3 text-xs text-slate-400 font-mono">{item.itemNumber || '-'}</td>
                        <td className="p-3 text-xs text-slate-500">{item.supplier || '-'}</td>
                        <td className="p-3 text-xs text-slate-500">{item.manufacturer || '-'}</td>
                      </>
                    )}
                    <td className="p-3 text-right text-xs font-mono text-slate-500">{item.quantity}</td>
                    <td className="p-3 text-right text-xs font-mono">{formatCurrency(item.unitPrice)}</td>
                    <td className="p-3 text-right text-xs font-mono font-bold text-blue-600">{formatCurrency(item.totalAmount)}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {type === 'plan' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onCompleteUse(item);
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                            title="사용완료 (사용 리스트로 복사)"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {type === 'usage' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onRestorePlan(item);
                            }}
                            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                            title="원복 (계획 리스트로 복사)"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditItem(item);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          title="수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete(item.id);
                          }}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // Show only a few pages around current page if there are many
                if (
                  totalPages > 10 && 
                  page !== 1 && 
                  page !== totalPages && 
                  Math.abs(page - currentPage) > 2
                ) {
                  if (Math.abs(page - currentPage) === 3) return <span key={page} className="px-2 text-slate-300">...</span>;
                  return null;
                }
                
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "w-10 h-10 rounded-xl text-sm font-bold transition-all",
                      currentPage === page 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                        : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            
            <div className="ml-4 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase">페이지 이동</span>
              <input 
                type="number"
                min="1"
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 1 && val <= totalPages) setCurrentPage(val);
                }}
                className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
          </div>
        )}
      </main>

      {/* Custom Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 text-rose-600 mb-6">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">항목 삭제 확인</h3>
            </div>
            <p className="text-slate-600 mb-8 leading-relaxed">
              정말로 이 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  const id = itemToDelete;
                  setItemToDelete(null);
                  await onDeleteItem(id);
                }}
                className="flex-1 px-6 py-3 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Floating Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 flex items-center gap-6 z-50 animate-in slide-in-from-bottom-8 duration-300">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              {selectedIds.size}
            </div>
            <span className="text-sm font-medium text-slate-600">개 항목 선택됨</span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              선택 해제
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-lg shadow-rose-100 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              선택 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
