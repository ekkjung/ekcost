export type CostCategory = '수선비' | '소모품비' | '기타경비' | '공정' | '설비' | '인건비' | '재료비' | '기타';

export interface CostItem {
  id: string;
  year: number;
  month: number;
  day: number;
  category: CostCategory;
  isPlanned: boolean;
  isIncludedInPlan: boolean;
  processModel?: string;
  processName?: string;
  equipmentName?: string;
  itemName: string;
  itemNumber?: string;
  supplier?: string;
  manufacturer?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  createdAt: string;
  uid?: string; // Keep for compatibility if needed, though we don't use it for auth now
}

export type Priority = 'Low' | 'Medium' | 'High';

export interface PlanItem {
  id: string;
  title: string;
  description: string;
  date: string;
  priority: Priority;
  category: string;
}

export interface ExcelRow {
  [key: string]: any;
}
