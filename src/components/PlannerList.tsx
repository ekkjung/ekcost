import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Tag, Trash2, AlertCircle } from 'lucide-react';
import { PlanItem } from '../types';

interface PlannerListProps {
  items: PlanItem[];
  onDelete: (id: string) => void;
}

export const PlannerList: React.FC<PlannerListProps> = ({ items, onDelete }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'Medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'Low': return 'text-green-400 bg-green-400/10 border-green-400/20';
      default: return 'text-white/40 bg-white/5 border-white/10';
    }
  };

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-white/20 italic"
          >
            등록된 계획이 없습니다.
          </motion.div>
        ) : (
          items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-6 group relative overflow-hidden"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white/90">{item.title}</h3>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${getPriorityColor(item.priority)}`}>
                      {item.priority}
                    </span>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">{item.description}</p>
                  
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex items-center gap-1.5 text-xs text-white/40">
                      <Calendar className="w-3.5 h-3.5" />
                      {item.date}
                    </div>
                    {item.category && (
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <Tag className="w-3.5 h-3.5" />
                        {item.category}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onDelete(item.id)}
                  className="p-2 rounded-lg bg-white/5 text-white/20 hover:bg-red-500/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {/* Subtle accent line */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500/50 to-purple-500/50 opacity-50" />
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
};
