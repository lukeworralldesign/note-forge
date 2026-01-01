import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ThemeColors, ServiceKeys } from '../types';

interface KeyVaultProps {
  theme: ThemeColors;
  onKeysUpdated: (keys: ServiceKeys) => void;
  compact?: boolean;
}

const KeyVault: React.FC<KeyVaultProps> = ({ theme, onKeysUpdated, compact = false }) => {
  const [keys, setKeys] = useState<ServiceKeys>({});
  const [isLinking, setIsLinking] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const tokenClient = useRef<any>(null);

  useEffect(() => {
    const checkGSI = setInterval(() => {
      if ((window as any).google?.accounts?.oauth2) {
        setSdkReady(true);
        clearInterval(checkGSI);
      }
    }, 500);
    return () => clearInterval(checkGSI);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('note_forge_service_keys');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ServiceKeys;
        setKeys(parsed);
        onKeysUpdated(parsed);
        
        // Check if token is expired on load
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          setTokenExpired(true);
        }
      } catch (e) {
        console.error("Failed to load keys", e);
      }
    }
  }, [onKeysUpdated]);

  const updateClientId = (id: string) => {
    const newKeys = { ...keys, clientId: id };
    setKeys(newKeys);
    onKeysUpdated(newKeys);
    localStorage.setItem('note_forge_service_keys', JSON.stringify(newKeys));
  };

  const handleGoogleConnect = useCallback((prompt: 'consent' | 'none' = 'consent') => {
    const google = (window as any).google;
    if (!google) return;
    if (!keys.clientId || keys.clientId.length < 10) {
      alert("Please paste your Google Client ID into the field first.");
      return;
    }

    setIsLinking(true);
    try {
        tokenClient.current = google.accounts.oauth2.initTokenClient({
            client_id: keys.clientId.trim(),
            scope: 'https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/calendar.events',
            callback: (response: any) => {
                setIsLinking(false);
                if (response.access_token) {
                    const expiresIn = response.expires_in || 3600; // Default 1 hour
                    const updated = { 
                      ...keys, 
                      tasks: response.access_token, 
                      calendar: response.access_token,
                      expiresAt: Date.now() + (expiresIn * 1000)
                    };
                    setKeys(updated);
                    onKeysUpdated(updated);
                    setTokenExpired(false);
                    localStorage.setItem('note_forge_service_keys', JSON.stringify(updated));
                } else if (response.error === 'immediate_failed') {
                    // Silent refresh failed, user needs to consent again
                    setTokenExpired(true);
                }
            }
        });
        tokenClient.current.requestAccessToken({ prompt: prompt });
    } catch (err) {
        setIsLinking(false);
        console.error("Init Error:", err);
    }
  }, [keys, onKeysUpdated]);

  const isConnected = (!!keys.tasks || !!keys.calendar) && !tokenExpired;
  const hasClientId = !!keys.clientId && keys.clientId.length > 20;

  return (
    <div className="w-full mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className={`flex items-center gap-2 ${theme.surface} p-1.5 rounded-full border ${tokenExpired ? 'border-[#FFB4AB]' : theme.surfaceBorder} shadow-sm group transition-all duration-300 focus-within:ring-1 ${theme.focusRing}`}>
        <div className="flex-1 px-4">
            <input 
                type="text" 
                value={keys.clientId || ''} 
                onChange={(e) => updateClientId(e.target.value)}
                placeholder="Paste Client ID here..."
                className={`w-full bg-transparent border-none text-[11px] font-medium tracking-tight uppercase focus:outline-none placeholder:text-[#8E9099] ${tokenExpired ? 'text-[#FFB4AB]' : 'text-[#E3E2E6]'}`}
            />
        </div>
        
        <div className="relative flex-shrink-0 mr-1">
            <button
                onClick={() => handleGoogleConnect('consent')}
                disabled={!sdkReady || isLinking || !hasClientId}
                className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md active:scale-90 bg-white
                    ${(!hasClientId || isLinking) ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:scale-105'}
                `}
                title={tokenExpired ? "Session Expired - Reconnect" : (isConnected ? "Identity Active" : "Authorize Google Sync")}
            >
                {isLinking ? (
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                )}
            </button>
            
            {isConnected && !isLinking && (
                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#C1CC94] rounded-full border border-[#191A12] flex items-center justify-center animate-in zoom-in-50 duration-300 shadow-sm pointer-events-none">
                    <span className="material-symbols-rounded text-[10px] text-[#191A12] font-black">done</span>
                </div>
            )}

            {tokenExpired && !isLinking && (
                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#FFB4AB] rounded-full border border-[#601410] flex items-center justify-center animate-bounce duration-300 shadow-sm pointer-events-none">
                    <span className="material-symbols-rounded text-[10px] text-[#601410] font-black">sync_problem</span>
                </div>
            )}
        </div>
      </div>
      {tokenExpired && (
        <div className="px-5 mt-2">
          <p className="text-[9px] font-bold text-[#FFB4AB] uppercase tracking-widest flex items-center gap-1.5">
            <span className="material-symbols-rounded text-[12px]">info</span>
            Google Session Expired. Tap the icon to re-authenticate.
          </p>
        </div>
      )}
    </div>
  );
};

export default KeyVault;