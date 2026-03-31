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
