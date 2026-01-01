import React, { useState, useEffect, useMemo } from 'react';
import { Note, ThemeColors, getCategoryStyle, ServiceKeys } from '../types';
import { reformatNoteContent } from '../services/geminiService';

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onEdit: (note: Note) => void;
  onAiError?: () => void;
  onKeyError?: () => void; // Added to notify parent when keys are invalid
  theme: ThemeColors;
  serviceKeys?: ServiceKeys;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete, onUpdate, onEdit, onAiError, onKeyError, theme, serviceKeys }) => {
  const [isReformatting, setIsReformatting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowDeleteConfirm(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showDeleteConfirm]);

  const handleExportToObsidian = async () => {
    const noteBody = note.content;
    const sanitizedHeadline = note.headline.replace(/[\\/:"*?<>|]/g, '').trim().substring(0, 50);
    const obsidianUri = `obsidian://new?name=${encodeURIComponent(sanitizedHeadline || note.id)}&content=${encodeURIComponent(noteBody)}`;
    try { await navigator.clipboard.writeText(noteBody); } catch (e) {}
    window.location.href = obsidianUri;
  };

  const handleExportToKeep = async () => {
    const shareData = { title: note.headline, text: note.content };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return;
      } catch (err) { if ((err as Error).name === 'AbortError') return; }
    }
    const fullText = `${note.headline}\n\n${note.content}`;
    try { await navigator.clipboard.writeText(fullText); } catch (e) {}
    setSyncStatus('success');
    setTimeout(() => {
        setSyncStatus('idle');
        window.open('https://keep.google.com/', '_blank');
    }, 1000);
  };

  const handleExportToTasks = async () => {
    if (serviceKeys?.tasks) {
        setIsSyncing(true);
        const token = serviceKeys.tasks.trim();
        const LIST_TITLE = 'note-forge';
        try {
            const listsResponse = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (listsResponse.status === 401) {
              if (onKeyError) onKeyError();
              throw new Error('TOKEN_EXPIRED');
            }
            if (!listsResponse.ok) throw new Error('LIST_FETCH_FAIL');
            const listsData = await listsResponse.json();
            let targetListId = listsData.items?.find((l: any) => l.title === LIST_TITLE)?.id;
            if (!targetListId) {
                const createListResponse = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: LIST_TITLE })
                });
                if (!createListResponse.ok) throw new Error('LIST_CREATE_FAIL');
                const newList = await createListResponse.json();
                targetListId = newList.id;
            }
            const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/${targetListId}/tasks`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: note.headline, notes: note.content })
            });
            if (!response.ok) throw new Error("API_FAIL");
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } finally { setIsSyncing(false); }
        return;
    }
    try { await navigator.clipboard.writeText(`${note.headline}\n\n${note.content}`); } catch (e) {}
    window.open('https://tasks.google.com/', '_blank');
  };

  const handleExportToCalendar = async () => {
    if (!note.eventDetails) return;
    if (serviceKeys?.calendar) {
        setIsSyncing(true);
        const token = serviceKeys.calendar.trim();
        try {
            const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    summary: note.eventDetails.title,
                    description: note.content,
                    start: { dateTime: note.eventDetails.start },
                    end: { dateTime: note.eventDetails.end }
                })
            });
            if (response.status === 401) {
              if (onKeyError) onKeyError();
              throw new Error('TOKEN_EXPIRED');
            }
            if (!response.ok) throw new Error("API_FAIL");
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } finally { setIsSyncing(false); }
    } else {
        const { title, start, end } = note.eventDetails;
        const gCalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(note.content)}&dates=${start.replace(/[-:]/g, '')}/${end.replace(/[-:]/g, '')}`;
        window.open(gCalUrl, '_blank');
    }
  };

  const handleReformat = async () => {
    if (isReformatting) return;
    setIsReformatting(true);
    try {
        const newContent = await reformatNoteContent(note.content, note.ragEnabled);
        if (newContent) onUpdate(note.id, { content: newContent, originalContent: note.content });
    } catch (e) { if (onAiError) onAiError(); } finally { setIsReformatting(false); }
  };

  const { previewText, isLong } = useMemo(() => {
    const words = note.content.trim().split(/\s+/);
    const isLong = words.length > 25;
    const previewText = isLong ? words.slice(0, 25).join(' ') + '...' : note.content;
    return { previewText, isLong };
  }, [note.content]);

  const style = getCategoryStyle(note.category);
  const cardBg = theme.key === 'pro' ? '#1E2228' : '#22241B';

  const isProcessed = note.aiStatus === 'completed';
  const showRecommended = (intent: string) => isProcessed && note.intent === intent;

  return (
    <div className="masonry-item group relative">
      <div className={`${theme.key === 'pro' ? 'bg-[#1E2228]' : 'bg-[#22241B]'} rounded-[1.5rem] p-5 border ${theme.surfaceBorder} overflow-hidden transition-all duration-300 relative`}>
        
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase" style={{ backgroundColor: style.bg, color: style.text }}>
              {note.category}
            </span>
            {note.ragEnabled && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 ${theme.primaryText} text-[8px] font-black uppercase tracking-[0.1em]`}>
                    <span className="material-symbols-rounded text-[10px]">database</span>
                    <span>Context</span>
                </div>
            )}
            {isProcessed && note.intent && (
              <span className="px-2 py-1 rounded-lg bg-white/5 text-[8px] font-black uppercase tracking-widest opacity-40 text-white">
                {note.intent}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(note)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#3F4042] text-[#8E9099]"><span className="material-symbols-rounded text-[18px]">edit</span></button>
            <button onClick={handleReformat} disabled={isReformatting} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isReformatting ? `${theme.primaryText} animate-pulse` : `text-[#8E9099] hover:bg-[#3F4042]`} `}><span className="material-symbols-rounded text-[20px]">auto_awesome</span></button>
            <button onClick={() => setShowDeleteConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#3F4042] text-[#8E9099]"><span className="material-symbols-rounded text-[18px]">delete</span></button>
          </div>
        </div>

        <h3 className="text-xl font-bold text-[#E3E2E6] mb-2 leading-tight">{note.headline}</h3>
        
        <div 
            onClick={() => isLong && setIsExpanded(!isExpanded)}
            className={`relative group/content cursor-pointer mb-6 transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px]' : 'max-h-32'}`}
        >
            <p className={`${theme.subtleText} text-base font-normal leading-relaxed whitespace-pre-wrap ${isReformatting ? 'opacity-50' : ''}`}>
                {isExpanded ? note.content : previewText}
            </p>
            {isLong && !isExpanded && (
                <div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none transition-opacity duration-300" style={{ background: `linear-gradient(transparent, ${cardBg})` }} />
            )}
            {isLong && (
                <div className={`mt-2 text-[9px] font-black uppercase tracking-widest ${theme.primaryText} opacity-0 group-hover/content:opacity-40 transition-opacity`}>
                    {isExpanded ? 'Click to collapse' : 'Click to read more'}
                </div>
            )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
            {note.tags.map((tag, idx) => (
            <span key={idx} className={`${theme.primaryText} text-xs font-medium opacity-80`}>#{tag}</span>
            ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Calendar Sync - Circular */}
          {note.calendarSync && (
            <button 
              onClick={handleExportToCalendar}
              className="w-12 h-12 flex-shrink-0 rounded-full transition-all flex items-center justify-center shadow-lg active:scale-90 bg-[#C2E7FF] text-[#003258] animate-in zoom-in duration-300"
              title="Schedule Calendar Event"
            >
              <span className="material-symbols-rounded text-2xl">calendar_month</span>
            </button>
          )}

          {/* Tasks - Circular */}
          <button 
            onClick={handleExportToTasks} 
            disabled={isSyncing}
            className={`w-12 h-12 flex-shrink-0 rounded-full transition-all flex items-center justify-center shadow-lg active:scale-90 relative ${syncStatus === 'success' && !isSyncing ? 'bg-[#C1CC94] text-[#191A12]' : syncStatus === 'error' ? 'bg-[#FFB4AB] text-[#601410]' : 'bg-[#D3E3FD] text-[#041E49] hover:bg-[#A8C7FA]'} ${showRecommended('task') ? 'ring-2 ring-offset-2 ring-offset-[#22241B] ring-[#3F7DE3]' : ''}`}
            title="Send to Tasks"
          >
            <span className={`material-symbols-rounded text-2xl ${isSyncing ? 'animate-spin' : ''}`}>{isSyncing ? 'sync' : (syncStatus === 'error' ? 'error' : 'task_alt')}</span>
            {showRecommended('task') && <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#3F7DE3] rounded-full border border-black shadow-sm" />}
          </button>
          
          {/* Keep - Pill */}
          <button 
            onClick={handleExportToKeep}
            className={`flex-1 min-w-[80px] h-12 rounded-full transition-all border border-[#444746] ${theme.surface} flex items-center justify-center gap-2 shadow-sm hover:bg-white/5 active:scale-95 relative ${showRecommended('ephemeral') ? 'ring-2 ring-offset-2 ring-offset-[#22241B] ring-[#D9C559]' : ''}`}
            title="Send to Keep"
          >
            <span 
              className="material-symbols-rounded text-xl" 
              style={{ color: showRecommended('ephemeral') ? '#D9C559' : undefined }}
            >
                {syncStatus === 'success' ? 'done' : 'share'}
            </span>
            <span 
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: showRecommended('ephemeral') ? '#D9C559' : undefined }}
            >
              Keep
            </span>
            {showRecommended('ephemeral') && <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#D9C559] rounded-full border border-black shadow-sm" />}
          </button>
          
          {/* Obsidian - Pill */}
          <button 
            onClick={handleExportToObsidian} 
            className={`flex-1 min-w-[100px] h-12 rounded-full border border-[#444746] ${theme.surface} flex items-center justify-center gap-2 shadow-sm hover:bg-white/5 transition-colors relative ${showRecommended('reference') ? 'ring-2 ring-offset-2 ring-offset-[#22241B] ring-[#D0BCFF]' : ''}`}
            title="Send to Obsidian"
          >
            <span 
              className="material-symbols-rounded text-xl"
              style={{ color: showRecommended('reference') ? '#D0BCFF' : undefined }}
            >
              diamond
            </span>
            <span 
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: showRecommended('reference') ? '#D0BCFF' : undefined }}
            >
              Obsidian
            </span>
            {showRecommended('reference') && <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#D0BCFF] rounded-full border border-black shadow-sm" />}
          </button>
        </div>

        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 p-4 bg-[#601410]/95 backdrop-blur-md flex flex-col items-center justify-center text-center rounded-[1.5rem]">
              <h4 className="text-lg font-bold text-white mb-5 tracking-tight">Purge Entry?</h4>
              <div className="flex flex-col w-full gap-2 max-w-[180px]">
                  <button onClick={() => onDelete(note.id)} className="w-full py-2.5 rounded-full bg-[#B3261E] text-[#FFB4AB] font-bold uppercase tracking-widest text-[10px]">Confirm</button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="w-full py-2.5 rounded-full bg-white/10 text-[#FFDAD6] font-bold uppercase tracking-widest text-[10px]">Cancel</button>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NoteCard;