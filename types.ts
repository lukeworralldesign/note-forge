
export interface Note {
  id: string;
  content: string;
  originalContent?: string;
  timestamp: number;
  aiStatus: 'idle' | 'processing' | 'completed' | 'error';
  category: string;
  headline: string;
  tags: string[];
  embedding?: number[];
}

export interface AIReponse {
  category: string;
  headline: string;
  tags: string[];
  embedding?: number[];
}

export type ModelTier = 'flash' | 'pro';

export interface ThemeColors {
  key: ModelTier;
  bg: string; // hex
  surface: string; // class
  surfaceHover: string; // class
  surfaceBorder: string; // class
  primaryText: string; // class
  primaryBg: string; // class
  onPrimaryText: string; // class
  secondaryBg: string; // class
  secondaryHover: string; // class
  secondaryText: string; // class
  accentHex: string;
  focusRing: string; // class
  border: string; // class
  subtleText: string; // class
}
