import React from 'react';
import { DateRange } from '../types';
import { Calendar } from 'lucide-react';

interface DateFilterProps {
  dateRange: DateRange;
  onDateChange: (range: DateRange) => void;
}

export const DateFilter: React.FC<DateFilterProps> = ({ dateRange, onDateChange }) => {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
      <div className="flex items-center gap-2 text-slate-600 font-medium">
        <Calendar className="w-5 h-5 text-indigo-600" />
        <span>Analysis Period</span>
      </div>
      
      {/* Smart grid: 
          - Mobile (cols-1): Stacked
          - Tablet (sm:cols-2): Side-by-side (full width)
          - Laptop (lg:cols-1): Stacked (sidebar is narrow)
          - Desktop (xl:cols-2): Side-by-side (sidebar is wide enough)
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 w-full">
        <div className="flex flex-col w-full">
          <label className="text-xs text-slate-500 mb-1.5 ml-1 font-medium">From</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => onDateChange({ ...dateRange, startDate: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
          />
        </div>
        
        <div className="flex flex-col w-full">
          <label className="text-xs text-slate-500 mb-1.5 ml-1 font-medium">To</label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => onDateChange({ ...dateRange, endDate: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
          />
        </div>
      </div>
    </div>
  );
};