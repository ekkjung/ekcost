import React, { useState, useMemo, useEffect } from 'react';
import { CostItem, CostCategory } from '../types';
import { ArrowLeft, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown, Plus, Search, FileDown, FileUp, Trash2, X, CheckCircle, RotateCcw, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { db, auth, collection, doc, setDoc } from '../firebase';

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

export function FullScreenListView({ type, items, onClose, formatCurrency, onDeleteItem, onEditItem, onAddNew, onCompleteUse, onRestorePlan }: FullScreenListViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof CostItem, direction: 'asc' | 'desc' } | null>({ key: 'year', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

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
      '계획': item.isIncludedInPlan ? '포함' : '미포함',
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

        const path = 'costs';
        let successCount = 0;
        
        for (const row of data) {
          try {
            const id = crypto.randomUUID();
            const docRef = doc(db, path, id);
            
            const isPlanned = type === 'plan';
            
            // '계획' 컬럼에서 포함/미포함 여부 확인 (사용 리스트용)
            const excelIsIncluded = row['계획'];
            const isIncludedInPlan = excelIsIncluded !== undefined 
              ? (excelIsIncluded === '포함' || excelIsIncluded === '당해년도 예산 포함')
              : (type === 'plan' ? true : false);

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
              isIncludedInPlan: isIncludedInPlan,
              createdAt: new Date().toISOString(),
              uid: auth.currentUser?.uid || 'anonymous',
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
    <div className="w-full h-full bg-white flex flex-col">
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
                  ...(type === 'usage' ? [{ label: '계획', key: 'isIncludedInPlan' }] : []),
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
                    {type === 'usage' && (
                      <td className="p-3">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded font-bold uppercase",
                          item.isIncludedInPlan ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                        )}>
                          {item.isIncludedInPlan ? '포함' : '미포함'}
                        </span>
                      </td>
                    )}
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
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                            title="계획 리스트로 복구"
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
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteItem(item.id);
                          }}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
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
        {filteredItems.length > itemsPerPage && (
          <div className="max-w-[1600px] mx-auto mt-8 flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.ceil(filteredItems.length / itemsPerPage) }, (_, i) => i + 1).map(page => {
                // Show only a range of pages if there are too many
                const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
                if (
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 2 && page <= currentPage + 2)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "w-10 h-10 rounded-xl text-sm font-bold transition-all",
                        currentPage === page 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      )}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  (page === currentPage - 3 && page > 1) || 
                  (page === currentPage + 3 && page < totalPages)
                ) {
                  return <span key={page} className="px-2 text-slate-300">...</span>;
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredItems.length / itemsPerPage), prev + 1))}
              disabled={currentPage === Math.ceil(filteredItems.length / itemsPerPage)}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
