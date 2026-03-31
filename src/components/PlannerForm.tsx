import React, { useState } from 'react';
import { Plus, Calendar, Tag, AlertCircle } from 'lucide-react';
import { PlanItem, Priority } from '../types';

interface PlannerFormProps {
  onAdd: (item: Omit<PlanItem, 'id'>) => void;
  initialData?: Partial<PlanItem> | null;
  onClearInitial?: () => void;
}

export const PlannerForm: React.FC<PlannerFormProps> = ({ onAdd, initialData, onClearInitial }) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    priority: initialData?.priority || 'Medium' as Priority,
    category: initialData?.category || '',
  });

  // Update form if initialData changes (e.g. from AI)
  React.useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        date: initialData.date || new Date().toISOString().split('T')[0],
        priority: initialData.priority || 'Medium',
        category: initialData.category || '',
      });
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    onAdd(formData);
    setFormData({
      title: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      priority: 'Medium',
      category: '',
    });
    onClearInitial?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider">제목</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="계획 제목을 입력하세요"
          className="w-full px-4 py-3 glass-input"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/40 uppercase tracking-wider">날짜</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full pl-10 pr-4 py-3 glass-input"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-white/40 uppercase tracking-wider">우선순위</label>
          <div className="relative">
            <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
              className="w-full pl-10 pr-4 py-3 glass-input appearance-none"
            >
              <option value="Low">낮음</option>
              <option value="Medium">중간</option>
              <option value="High">높음</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider">카테고리</label>
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="예: 업무, 개인, 여행"
            className="w-full pl-10 pr-4 py-3 glass-input"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider">상세 설명</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="상세 내용을 입력하세요"
          className="w-full px-4 py-3 glass-input min-h-[100px] resize-none"
        />
      </div>

      <button type="submit" className="w-full btn-primary flex items-center justify-center gap-2">
        <Plus className="w-5 h-5" />
        계획 추가하기
      </button>
    </form>
  );
};
