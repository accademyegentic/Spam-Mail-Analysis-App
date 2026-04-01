import React from 'react';
import { DateRange } from '../types';
import { Calendar, Clock } from 'lucide-react';

interface DateFilterProps {
  dateRange: DateRange;
  onDateChange: (range: DateRange) => void;
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

export const DateFilter: React.FC<DateFilterProps> = ({ dateRange, onDateChange }) => {
  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onDateChange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Analysis Period</span>
        </div>
        <div className="flex items-center gap-1">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              className="text-[11px] font-semibold px-2 py-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> From
          </label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => onDateChange({ ...dateRange, startDate: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> To
          </label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => onDateChange({ ...dateRange, endDate: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:outline-none transition-all shadow-sm"
          />
        </div>
      </div>
    </div>
  );
};
