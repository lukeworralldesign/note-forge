
import React, { useState, useRef, useEffect } from 'react';
import { ThemeColors } from '../types';

interface TheForgeProps {
  onSave: (content: string, ragEnabled: boolean) => void;
  theme: ThemeColors;
  onFocusChange?: (focused: boolean) => void;
  initialContent?: string;
  isEditing?: boolean;
  initialRagEnabled?: boolean;
  onCancelEdit?: () => void;
}

const TheForge: React.FC<TheForgeProps> = ({ 
    onSave, 
    theme, 
    onFocusChange, 
    initialContent = '', 
    isEditing = false,
    initialRagEnabled = false,
    onCancelEdit 
}) => {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(initialRagEnabled);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(initialContent);
    setRagEnabled(initialRagEnabled);
    if (isEditing && initialContent && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(initialContent.length, initialContent.length);
    }
  }, [initialContent, isEditing, initialRagEnabled]);

  const handleFocus = () => {
    setIsFocused(true);
    if (onFocusChange) onFocusChange(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (onFocusChange) onFocusChange(false);
  };

  const handleSubmit = () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;
    
    onSave(trimmedContent, ragEnabled);
    
    if (!isEditing) {
      setContent('');
    }
  };

  const ringColor = isEditing ? 'ring-[#FFB74D]' : theme.focusRing;
  const buttonBg = isEditing ? 'bg-[#FFB74D]' : theme.primaryBg;
  const buttonText = isEditing ? 'text-[#4E342E]' : theme.onPrimaryText;

  // Material 3 Surface Colors (Flat)
  const chipBg = ragEnabled ? theme.secondaryBg : 'bg-[#1C1B1F]';
  const chipTextColor = ragEnabled ? theme.secondaryText : 'text-[#C4C7C5]';

  return (
    <div className={`w-full mb-8 transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform ${isFocused ? 'scale-[1.02] -translate-y-1' : 'scale-100 translate-y-0'}`}>
      <div 
        className={`
            flex flex-col overflow-hidden
            ${theme.surface}
            rounded-[2.5rem] 
            transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
            ${isFocused || isEditing ? `ring-2 ${ringColor} shadow-[0_32px_80px_-16px_rgba(0,0,0,0.5)]` : 'shadow-lg shadow-black/10'}
        `}
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isEditing ? "Modifying entry..." : "New note..."}
          enterKeyHint="send"
          className="w-full h-48 md:h-64 bg-transparent p-8 text-xl md:text-2xl text-[#FDFDFF] placeholder-[#8E9099] focus:outline-none resize-none leading-relaxed transition-all duration-500"
          style={{ fontVariationSettings: '"wght" 450' }}
        />

        <div className="flex items-center justify-between px-8 pb-8">
            {/* Flat M3 Expressive Toggle Chip: [Icon] RAG [Switch] */}
            <div 
              onClick={() => setRagEnabled(!ragEnabled)}
              className={`
                flex items-center gap-3 px-4 h-12 rounded-full cursor-pointer transition-all duration-300 border-2 border-transparent
                ${chipBg} hover:brightness-110 active:scale-95 select-none
              `}
            >
                {/* Leading Icon - Per guidance image */}
                <span className={`material-symbols-rounded text-xl transition-colors duration-300 ${chipTextColor}`}>
                    {ragEnabled ? 'database' : 'database_off'}
                </span>

                <span className={`text-[11px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${chipTextColor}`}>
                    RAG
                </span>
                
                {/* M3 Expressive Switch Component */}
                <div className={`
                    w-12 h-7 rounded-full relative transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    ${ragEnabled ? theme.primaryBg : 'bg-[#444746]'}
                `}>
                    <div className={`
                        absolute top-1 w-5 h-5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                        flex items-center justify-center
                        ${ragEnabled 
                          ? 'left-6 bg-[#1C1B1F] scale-110' 
                          : 'left-1 bg-[#938F99] scale-100'}
                    `} />
                </div>
            </div>

            <div className="flex items-center gap-6">
                 {isEditing && (
                     <button 
                        onClick={onCancelEdit}
                        className="text-xs font-black uppercase tracking-[0.2em] text-[#FFB4AB] hover:bg-[#3F1111] px-6 py-3 rounded-full transition-colors"
                     >
                         Cancel
                     </button>
                 )}

                <button
                    onClick={handleSubmit}
                    disabled={!content.trim()}
                    className={`
                        flex items-center justify-center
                        h-16 w-16 rounded-[22px]
                        transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
                        ${content.trim() 
                            ? `${buttonBg} ${buttonText} shadow-xl hover:shadow-2xl hover:scale-110 active:scale-90` 
                            : 'bg-black/20 text-[#444746] cursor-not-allowed'}
                    `}
                >
                    <span className="material-symbols-rounded text-3xl">
                        {isEditing ? 'save' : 'send'}
                    </span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TheForge;
