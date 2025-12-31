
import React, { useMemo } from 'react';
import { Note, ThemeColors } from '../types';

interface ActivityInsightsProps {
  notes: Note[];
  theme: ThemeColors;
  isOpen: boolean;
  onClose: () => void;
  swipeOffset: number;
  isSwiping: boolean;
  onDateClick: (dateStr: string) => void;
  getFocusModeOverlayColor: (hex: string, alpha: number) => string;
  backdropOpacity: number;
}

const ActivityInsights: React.FC<ActivityInsightsProps> = ({ 
  notes, 
  theme, 
  isOpen, 
  onClose, 
  swipeOffset, 
  isSwiping,
  onDateClick,
  getFocusModeOverlayColor,
  backdropOpacity
}) => {
  const DAYS_OF_WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const activityData = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(note => {
      const dateStr = new Date(note.timestamp).toISOString().split('T')[0];
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    return counts;
  }, [notes]);

  // Generate 52 weeks (364 days) of history aligned to Mondays
  const { weeks, totalNotes } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Create a start point 364 days ago
    const start = new Date(now);
    start.setDate(start.getDate() - 364); 
    
    // Align to the nearest Monday
    const dayOfWeek = start.getDay(); 
    const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start.setDate(start.getDate() - diffToMon);

    const weeksList: { monthLabel: string | null, days: Date[] }[] = [];
    let current = new Date(start);
    let totalCount = 0;

    for (let w = 0; w < 53; w++) {
      const weekDays: Date[] = [];
      let monthLabel: string | null = null;
      
      for (let d = 0; d < 7; d++) {
        const day = new Date(current);
        weekDays.push(day);
        
        // Month label logic: Only show at the start of a week if it's the first week of that month
        if (day.getDate() <= 7 && d === 0) { 
            monthLabel = day.toLocaleString('default', { month: 'short' });
        }
        
        const dStr = day.toISOString().split('T')[0];
        totalCount += (activityData[dStr] || 0);
        current.setDate(current.getDate() + 1);
      }
      weeksList.push({ monthLabel, days: weekDays });
    }

    // Chronological order: Oldest (January or -364d) at top
    return { weeks: weeksList, totalNotes: totalCount };
  }, [activityData]);

  const getHeatStyle = (count: number, isFuture: boolean) => {
    if (isFuture) return { backgroundColor: 'rgba(255,255,255,0.02)' };
    if (count === 0) return { backgroundColor: 'rgba(255,255,255,0.05)' };
    
    const alpha = count === 1 ? '33' : count === 2 ? '66' : count <= 4 ? 'BB' : 'FF';
    const baseColor = `${theme.accentHex}${alpha}`;
    
    return { 
      backgroundColor: baseColor,
      boxShadow: count >= 5 ? `0 0 15px ${theme.accentHex}44` : 'none'
    };
  };

  const getTransform = () => {
    if (isSwiping) {
      if (isOpen) {
        return `translateX(${Math.min(0, swipeOffset)}px)`;
      } else {
        return `translateX(calc(-100% + ${Math.max(0, swipeOffset)}px))`;
      }
    }
    return isOpen ? 'translateX(0)' : 'translateX(-100%)';
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999] overflow-y-auto anti-alias-container backdrop-blur-sm transition-transform duration-500 ease-[cubic-bezier(0.33,1,0.68,1)] touch-pan-y ${isSwiping ? 'duration-0' : ''}`}
      style={{ 
        backgroundColor: getFocusModeOverlayColor(theme.bg, backdropOpacity),
        transform: getTransform(),
        visibility: (isOpen || isSwiping) ? 'visible' : 'hidden'
      }}
    >
      <div className="max-w-5xl mx-auto px-5 w-full min-h-full flex flex-col pointer-events-auto pt-safe pb-safe">
        <div className="pt-10 pb-10 flex items-center justify-between flex-shrink-0">
          <div className="flex flex-col">
            <h1 
              className="text-3xl md:text-5xl text-[#E3E2E6] tracking-tight transition-all duration-700" 
              style={{ fontVariationSettings: '"wght" 600, "wdth" 100, "slnt" 0' }}
            >
              insights
            </h1>
            <div className={`flex items-center gap-2 ${theme.primaryText} text-[10px] font-bold uppercase tracking-[0.2em] mt-2 opacity-60`}>
              {totalNotes} CONTRIBUTIONS IN THE LAST YEAR
            </div>
          </div>
          <button 
            onClick={onClose} 
            className={`w-12 h-12 rounded-full ${theme.surface} flex items-center justify-center text-[#E3E2E6] shadow-xl active:scale-90 border border-white/10 hover:bg-white/10 transition-all`}
          >
            <span className="material-symbols-rounded text-2xl">close</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center">
            <div className="flex w-full max-w-[400px] mb-4 pl-12 pr-2">
                {DAYS_OF_WEEK_LABELS.map((label, i) => (
                    <div key={i} className="flex-1 text-center text-[10px] font-black text-white/20 tracking-widest">{label}</div>
                ))}
            </div>

            <div className="w-full max-w-[400px] flex flex-col gap-1.5 pb-12">
                {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex items-center gap-2 group">
                        <div className="w-12 flex-shrink-0 text-[10px] font-black uppercase tracking-tighter text-white/30 text-right pr-4 h-5 flex items-center justify-end">
                            {week.monthLabel}
                        </div>
                        <div className="flex-1 grid grid-cols-7 gap-1.5">
                            {week.days.map((date) => {
                                const dStr = date.toISOString().split('T')[0];
                                const count = activityData[dStr] || 0;
                                const isFuture = date > new Date();
                                return (
                                    <button 
                                        key={dStr}
                                        onClick={() => count > 0 && onDateClick(dStr)}
                                        disabled={count === 0 || isFuture}
                                        className={`
                                            aspect-square rounded-[3px] transition-all duration-300
                                            ${count > 0 ? 'hover:scale-125 hover:z-10 cursor-pointer hover:rounded-md active:scale-90' : 'cursor-default'}
                                        `}
                                        style={getHeatStyle(count, isFuture)}
                                        title={`${dStr}: ${count} notes`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="w-full max-w-[400px] flex items-center justify-end gap-3 pb-32 text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                <span>Less</span>
                <div className="flex gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-[2px]" style={getHeatStyle(0, false)}></div>
                    <div className="w-3.5 h-3.5 rounded-[2px]" style={getHeatStyle(1, false)}></div>
                    <div className="w-3.5 h-3.5 rounded-[2px]" style={getHeatStyle(2, false)}></div>
                    <div className="w-3.5 h-3.5 rounded-[2px]" style={getHeatStyle(4, false)}></div>
                    <div className="w-3.5 h-3.5 rounded-[2px]" style={getHeatStyle(5, false)}></div>
                </div>
                <span>More</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityInsights;
