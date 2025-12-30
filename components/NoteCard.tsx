
import React, { useState, useEffect } from 'react';
import { Note, ThemeColors, getCategoryStyle, ServiceKeys } from '../types';
import { reformatNoteContent } from '../services/geminiService';

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onEdit: (note: Note) => void;
  onAiError?: () => void;
  theme: ThemeColors;
  serviceKeys?: ServiceKeys;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete, onUpdate, onEdit, onAiError, theme, serviceKeys }) => {
  const [isReformatting, setIsReformatting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

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
    const shareData = {
      title: note.headline,
      text: note.content,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 2000);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
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
            // 1. Get all task lists to find "note-forge"
            const listsResponse = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!listsResponse.ok) throw new Error('LIST_FETCH_FAIL');
            const listsData = await listsResponse.json();
            
            let targetListId = listsData.items?.find((l: any) => l.title === LIST_TITLE)?.id;

            // 2. Create the list if it doesn't exist
            if (!targetListId) {
                const createListResponse = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ title: LIST_TITLE })
                });
                if (!createListResponse.ok) throw new Error('LIST_CREATE_FAIL');
                const newList = await createListResponse.json();
                targetListId = newList.id;
            }

            // Calculate due date (Current time + 2 hours)
            const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;
            const dueTimestamp = new Date(Date.now() + TWO_HOURS_IN_MS).toISOString();

            // 3. Post the actual task to the specialized list
            const response = await fetch(`https://www.googleapis.com/tasks/v1/lists/${targetListId}/tasks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: note.headline,
                    notes: note.content,
                    due: dueTimestamp // Set 2-hour timer by default
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                console.error("Tasks API Error:", data);
                if (response.status === 401) {
                    alert("Your Google session has expired. Please tap 'Authorize Sync' again in the Vault.");
                } else if (response.status === 403) {
                    alert("Sync Failed (403): Ensure 'Google Tasks API' is ENABLED in your Google Cloud Project library.");
                } else {
                    alert(`Sync Error (${response.status}): ${data.error?.message || 'Unknown error'}`);
                }
                throw new Error("API_FAIL");
            }

            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            console.error("Task Sync Catch:", e);
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 3000);
        } finally {
            setIsSyncing(false);
        }
        return;
    }
    
    // Fallback: Copy to clipboard and open Tasks web
    try { await navigator.clipboard.writeText(`${note.headline}\n\n${note.content}`); } catch (e) {}
    alert("Copied to clipboard. Redirecting to manual Tasks...");
    window.open('https://tasks.google.com/', '_blank');
  };

  const handleReformat = async () => {
    if (isReformatting) return;
    setIsReformatting(true);
    try {
        const newContent = await reformatNoteContent(note.content);
        if (newContent) onUpdate(note.id, { content: newContent, originalContent: note.content });
    } catch (e) { if (onAiError) onAiError(); } finally { setIsReformatting(false); }
  };

  const style = getCategoryStyle(note.category);

  return (
    <div className="masonry-item group relative">
      <div className={`${theme.key === 'pro' ? 'bg-[#1E2228]' : 'bg-[#22241B]'} rounded-[1.5rem] p-5 border ${theme.surfaceBorder} overflow-hidden transition-all duration-300 relative`}>
        
        <div className="flex justify-between items-start mb-4">
          <span className="px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase" style={{ backgroundColor: style.bg, color: style.text }}>
            {note.category}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(note)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#3F4042] text-[#8E9099]"><span className="material-symbols-rounded text-[18px]">edit</span></button>
            <button onClick={handleReformat} disabled={isReformatting} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isReformatting ? `${theme.primaryText} animate-pulse` : `text-[#8E9099] hover:bg-[#3F4042]`} `}><span className="material-symbols-rounded text-[20px]">auto_awesome</span></button>
            <button onClick={() => setShowDeleteConfirm(true)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#3F4042] text-[#8E9099]"><span className="material-symbols-rounded text-[18px]">delete</span></button>
          </div>
        </div>

        <h3 className="text-xl font-bold text-[#E3E2E6] mb-2 leading-tight">{note.headline}</h3>
        <p className={`${theme.subtleText} text-base font-normal leading-relaxed mb-6 whitespace-pre-wrap ${isReformatting ? 'opacity-50' : ''}`}>{note.content}</p>

        <div className="flex flex-wrap gap-2 mb-6">
            {note.tags.map((tag, idx) => (
            <span key={idx} className={`${theme.primaryText} text-xs font-medium opacity-80`}>#{tag}</span>
            ))}
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportToTasks} 
            disabled={isSyncing}
            className={`w-12 h-12 flex-shrink-0 rounded-full transition-all flex items-center justify-center shadow-lg active:scale-90 ${syncStatus === 'success' && !isSyncing ? 'bg-[#C1CC94] text-[#191A12]' : syncStatus === 'error' ? 'bg-[#FFB4AB] text-[#601410]' : 'bg-[#D3E3FD] text-[#041E49] hover:bg-[#A8C7FA]'}`}
          >
            <span className={`material-symbols-rounded text-2xl ${isSyncing ? 'animate-spin' : ''}`}>{isSyncing ? 'sync' : (syncStatus === 'error' ? 'error' : 'task_alt')}</span>
          </button>
          
          <button 
            onClick={handleExportToKeep}
            className={`flex-1 h-12 rounded-full transition-all border border-[#444746] ${theme.surface} ${theme.primaryText} text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:bg-white/5 active:scale-95`}
          >
            <span className="material-symbols-rounded text-lg">
                {syncStatus === 'success' ? 'done' : 'share'}
            </span>
            {syncStatus === 'success' ? 'Shared' : 'To Keep'}
          </button>
          
          <button onClick={handleExportToObsidian} className={`flex-1 h-12 rounded-full border border-[#444746] ${theme.surface} ${theme.primaryText} text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:bg-white/5 transition-colors`}><span className="material-symbols-rounded text-lg">diamond</span>Obsidian</button>
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
