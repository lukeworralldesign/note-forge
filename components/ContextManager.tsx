
import React, { useState, useEffect } from 'react';
import { ModelTier, ThemeColors } from '../types';

interface ContextManagerProps {
  modelTier: ModelTier;
  onTierChange: (tier: ModelTier) => void;
  theme: ThemeColors;
}

const ContextManager: React.FC<ContextManagerProps> = ({ modelTier, onTierChange, theme }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const storedName = localStorage.getItem('note_forge_context_filename');
    if (storedName) {
      setFileName(storedName);
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported.');
      setLoading(false);
      return;
    }

    if (file.size > 4 * 1024 * 1024) { 
      setError('File is too large for local storage (Limit: ~4MB).');
      setLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      const base64Data = base64String.split(',')[1];
      
      try {
        localStorage.setItem('note_forge_context_pdf', base64Data);
        localStorage.setItem('note_forge_context_filename', file.name);
        setFileName(file.name);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Storage quota exceeded. Please use a smaller file.');
        setLoading(false);
      }
    };
    
    reader.onerror = () => {
      setError('Failed to read file.');
      setLoading(false);
    };

    reader.readAsDataURL(file);
  };

  const clearContext = () => {
    try {
      localStorage.removeItem('note_forge_context_pdf');
      localStorage.removeItem('note_forge_context_filename');
      setFileName(null);
      setError(null);
    } catch (e) {
      console.error("Clear failed", e);
    }
  };

  return (
    <div className="w-full mt-12 mb-8 pt-8 border-t border-[#444746]/50">
      <h3 className={`${theme.subtleText} text-xs font-bold uppercase tracking-widest mb-4 opacity-80`}>
        System Configuration
      </h3>
      
      <div className={`${theme.surface} rounded-2xl p-6 ${theme.surfaceBorder} flex flex-col gap-8 transition-colors duration-500`}>
        
        <div className="flex flex-col gap-2">
            <span className="text-[#E3E2E6] font-medium text-sm">Reference Material (RAG)</span>
            <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 w-full">
                {fileName ? (
                    <div className={`flex items-center justify-between ${modelTier === 'flash' ? 'bg-[#191A12]' : 'bg-[#0E1216]'} p-4 rounded-xl border ${theme.border} border-opacity-30`}>
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`w-10 h-10 rounded-full ${theme.secondaryBg} flex items-center justify-center ${theme.primaryText}`}>
                                <span className="material-symbols-rounded text-xl">description</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[#E3E2E6] font-medium text-sm truncate block">{fileName}</span>
                                <span className={`${theme.primaryText} text-xs`}>Active Context</span>
                            </div>
                        </div>
                        <button onClick={clearContext} className="p-2 text-[#FFB4AB] hover:bg-[#3F1111] rounded-full">
                            <span className="material-symbols-rounded text-xl">delete</span>
                        </button>
                    </div>
                ) : (
                    <label className={`flex flex-col items-center justify-center w-full h-24 border border-dashed border-[#444746] rounded-xl cursor-pointer hover:${theme.border} hover:bg-black/20 transition-all group`}>
                        <div className="flex items-center gap-3">
                            <span className={`material-symbols-rounded text-2xl text-[#8E9099] group-hover:${theme.primaryText}`}>cloud_upload</span>
                            <span className={`${theme.subtleText} text-sm`}>Upload PDF Context</span>
                        </div>
                        <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={loading} />
                    </label>
                )}
                </div>
            </div>
        </div>

        <div className="h-[1px] w-full bg-[#444746]/50"></div>

        <div className="flex flex-col gap-4">
            <span className="text-[#E3E2E6] font-medium text-sm">Gemini Model</span>
            
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => onTierChange('flash')}
                    className={`flex flex-col items-start p-4 rounded-xl border transition-all ${
                        modelTier === 'flash' 
                        ? 'bg-[#191A12] border-[#C1CC94] ring-1 ring-[#C1CC94]' 
                        : 'bg-transparent border-[#444746] opacity-60 hover:opacity-100 hover:bg-[#22241C]'
                    }`}
                >
                    <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-[#C1CC94] font-bold text-xs tracking-wider">GEMINI 3 FLASH</span>
                        {modelTier === 'flash' && <div className="w-2 h-2 rounded-full bg-[#C1CC94]"></div>}
                    </div>
                    <span className="text-[#E3E2E6] text-sm font-semibold mb-1">Fast & Efficient</span>
                    <span className="text-[#8E9099] text-[10px]">Best for quick notes and standard categorization.</span>
                </button>

                <button 
                    onClick={() => onTierChange('pro')}
                    className={`flex flex-col items-start p-4 rounded-xl border transition-all ${
                        modelTier === 'pro' 
                        ? 'bg-[#0E1216] border-[#C2E7FF] ring-1 ring-[#C2E7FF]' 
                        : 'bg-transparent border-[#444746] opacity-60 hover:opacity-100 hover:bg-[#22241C]'
                    }`}
                >
                     <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-[#C2E7FF] font-bold text-xs tracking-wider">GEMINI 3 PRO</span>
                        {modelTier === 'pro' && <div className="w-2 h-2 rounded-full bg-[#C2E7FF]"></div>}
                    </div>
                    <span className="text-[#E3E2E6] text-sm font-semibold mb-1">Deep Reasoning</span>
                    <span className="text-[#8E9099] text-[10px]">Best for complex context and advanced reformatting.</span>
                </button>
            </div>
        </div>

        {error && (
            <p className="text-[#FFB4AB] font-bold text-xs flex items-center gap-2 mt-[-10px]">
                <span className="material-symbols-rounded text-sm">error</span>
                {error}
            </p>
        )}
      </div>
    </div>
  );
};

export default ContextManager;
