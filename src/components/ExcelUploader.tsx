import React, { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import { ExcelRow, PlanItem } from '../types';
import { analyzeExcelData } from '../lib/gemini';

interface ExcelUploaderProps {
  onDataLoaded: (items: Partial<PlanItem>[]) => void;
}

export const ExcelUploader: React.FC<ExcelUploaderProps> = ({ onDataLoaded }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as ExcelRow[];

        if (data.length > 0) {
          const analyzedItems = await analyzeExcelData(data);
          onDataLoaded(analyzedItems);
        }
        setIsAnalyzing(false);
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error("Error reading excel:", error);
      setIsAnalyzing(false);
    }
  }, [onDataLoaded]);

  return (
    <div className="relative">
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isAnalyzing ? (
            <>
              <Loader2 className="w-8 h-8 mb-3 text-blue-400 animate-spin" />
              <p className="text-sm text-white/60">AI 분석 중...</p>
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-8 h-8 mb-3 text-white/40 group-hover:text-blue-400 transition-colors" />
              <p className="mb-2 text-sm text-white/60">
                <span className="font-semibold">엑셀 파일 업로드</span> 또는 드래그 앤 드롭
              </p>
              <p className="text-xs text-white/40">XLSX, XLS, CSV 지원</p>
            </>
          )}
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept=".xlsx, .xls, .csv" 
          onChange={handleFileUpload}
          disabled={isAnalyzing}
        />
      </label>
    </div>
  );
};
