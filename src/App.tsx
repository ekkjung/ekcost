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
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { LedgerPage } from './components/LedgerPage';
import { FullScreenListView } from './components/FullScreenListView';
import { Home } from './components/Home';
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
  writeBatch,
  auth
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

const CATEGORIES: CostCategory[] = ['수선비', '소모품비', '기타경비'];
const YEARS = [2024, 2025, 2026, 2027];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function AppContent() {
  const [items, setItems] = useState<CostItem[]>([]);
  const [activePage, setActivePage] = useState('home');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<CostItem>({
    id: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    category: '수선비',
    isPlanned: true,
    itemName: '',
    quantity: 0,
    unitPrice: 0,
    totalAmount: 0,
    isIncludedInPlan: true,
    createdAt: new Date().toISOString(),
    uid: auth.currentUser?.uid || 'anonymous',
  });

  const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);

  const deleteItem = async (id: string) => {
    await deleteDoc(doc(db, 'costs', id));
  };

  const handleEdit = (item: CostItem) => {
    setNewItem(item);
    setEditingId(item.id);
    setIsAdding(true);
  };

  const handleAddNew = (isPlanned: boolean) => {
    setNewItem({
      id: '',
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      day: new Date().getDate(),
      category: '수선비',
      isPlanned,
      itemName: '',
      quantity: 0,
      unitPrice: 0,
      totalAmount: 0,
      isIncludedInPlan: true,
      createdAt: new Date().toISOString(),
      uid: auth.currentUser?.uid || 'anonymous',
    });
    setEditingId(null);
    setIsAdding(true);
  };

  const filteredItems = items; 

  const requestSort = (key: keyof CostItem) => {}; 

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error('로그인이 필요합니다. 사이드바에서 로그인해 주세요.');
      return;
    }
    try {
      const docRef = editingId ? doc(db, 'costs', editingId) : doc(collection(db, 'costs'));
      const finalItem = { 
        ...newItem, 
        id: docRef.id,
        uid: auth.currentUser.uid,
        totalAmount: newItem.quantity * newItem.unitPrice,
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, finalItem);
      toast.success(editingId ? '수정되었습니다.' : '저장되었습니다.');
      setIsAdding(false);
      setEditingId(null);
    } catch (error) {
      console.error("Save error:", error);
      handleFirestoreError(error, OperationType.WRITE, 'costs');
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

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

  const onCompleteUse = async (item: CostItem) => {
    const id = crypto.randomUUID();
    const docRef = doc(db, 'costs', id);
    const newItem: CostItem = {
      ...item,
      id,
      isPlanned: false,
      createdAt: new Date().toISOString(),
      uid: auth.currentUser?.uid || 'anonymous',
    };
    await setDoc(docRef, newItem);
    toast.success("사용 리스트로 복사되었습니다.");
  };

  const onRestorePlan = async (item: CostItem) => {
    const id = crypto.randomUUID();
    const docRef = doc(db, 'costs', id);
    const newItem: CostItem = {
      ...item,
      id,
      isPlanned: true,
      createdAt: new Date().toISOString(),
      uid: auth.currentUser?.uid || 'anonymous',
    };
    await setDoc(docRef, newItem);
    toast.success("계획 리스트로 복사되었습니다.");
  };

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <Home items={items} formatCurrency={formatCurrency} />;
      case 'plan':
        return <FullScreenListView type="plan" items={items} onClose={() => setActivePage('home')} formatCurrency={formatCurrency} onDeleteItem={deleteItem} onEditItem={handleEdit} onAddNew={() => handleAddNew(true)} onCompleteUse={onCompleteUse} onRestorePlan={onRestorePlan} />;
      case 'usage':
        return <FullScreenListView type="usage" items={items} onClose={() => setActivePage('home')} formatCurrency={formatCurrency} onDeleteItem={deleteItem} onEditItem={handleEdit} onAddNew={() => handleAddNew(false)} onCompleteUse={onCompleteUse} onRestorePlan={onRestorePlan} />;
      case 'history':
        return <LedgerPage items={filteredItems} formatCurrency={formatCurrency} onDeleteItem={deleteItem} onEditItem={handleEdit} requestSort={requestSort} />;
      case 'dashboard':
        return <Dashboard items={items} />;
      default:
        return <Home items={items} formatCurrency={formatCurrency} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="flex-1 overflow-auto">
        {renderPage()}
      </div>

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
                  <select 
                    value={newItem.isIncludedInPlan ? 'included' : 'excluded'}
                    onChange={(e) => setNewItem({ ...newItem, isIncludedInPlan: e.target.value === 'included' })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                  >
                    <option value="included">포함</option>
                    <option value="excluded">미포함</option>
                  </select>
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
                    onChange={(e) => {
                      const q = Number(e.target.value);
                      setNewItem({ ...newItem, quantity: q, totalAmount: q * newItem.unitPrice });
                    }}
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
                    onChange={(e) => {
                      const p = Number(e.target.value);
                      setNewItem({ ...newItem, unitPrice: p, totalAmount: newItem.quantity * p });
                    }}
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
                {editingId ? '수정' : '저장'}
              </button>
            </form>
          </div>
        </div>
      )}
      <Toaster position="top-center" richColors />
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
