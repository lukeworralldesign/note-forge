
import { GoogleGenAI, Type } from "@google/genai";
import { AIReponse, ModelTier } from "../types";
// @ts-ignore
import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js for browser environment
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;
// Explicitly set the remote host and template to ensure reliable fetches from Hugging Face
env.remoteHost = 'https://huggingface.co';
// The template should end with a slash; the library appends the specific filename.
env.remotePathTemplate = '{model}/resolve/{revision}/';

let currentTier: ModelTier = 'flash';
let localEmbedder: any = null;
let initializationPromise: Promise<any> | null = null;

export const setModelTier = (tier: ModelTier) => {
  currentTier = tier;
};

/**
 * Initializes the local embedder with retry logic for robust network handling.
 */
export const initLocalEmbedder = async (retries = 2) => {
  if (localEmbedder) return localEmbedder;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    let lastError: any = null;
    for (let i = 0; i <= retries; i++) {
      try {
        // Use a lightweight model for better fetch success rates in browsers
        localEmbedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          progress_callback: (p: any) => {
            if (p.status === 'progress') {
                // Potential for a progress bar in UI later
            }
          }
        });
        console.log("Local embedder initialized successfully.");
        return localEmbedder;
      } catch (e: any) {
        lastError = e;
        if (e.message?.includes('fetch') || e instanceof TypeError || e.message?.includes('locate file')) {
          console.warn(`Local embedder fetch attempt ${i + 1} failed. ${i < retries ? 'Retrying...' : 'Falling back to keyword search.'}`);
          // Wait before retrying (exponential backoff)
          if (i < retries) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        } else {
          // If it's not a fetch error, break early
          break;
        }
      }
    }
    console.error("Local embedder failed to initialize after retries:", lastError);
    initializationPromise = null; // Allow future retry if needed
    return null;
  })();

  return initializationPromise;
};

export const getLocalEmbedding = async (text: string): Promise<number[] | null> => {
  try {
    const model = await initLocalEmbedder();
    if (!model) return null;
    const output = await model(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data) as number[];
  } catch (e) {
    console.warn("Local embedding generation failed silently", e);
    return null;
  }
};

const TAG_LIBRARY = `
Work, Personal, Urgent, To-Do, Ideas, Goals, Project, Meeting, Finance, Health, Travel, Home, Shopping, Tech, Learning, Reference, Archive, Journal, Events, Family, Friends, Career, Education, Books, Movies, Music, Art, Design, Code, Marketing, Sales, Legal, Taxes, Bills, Recipes, Fitness, Meditation, Hobbies, Gaming, News, Politics, Science, History, Geography, Languages, DIY, Maintenance, Vehicles, Pets, Garden, Important, Later, Waiting, Research, Inspiration, Review, Draft, Final, Security
`;

const getContextPDF = (): string | null => {
  try {
    return localStorage.getItem('note_forge_context_pdf');
  } catch (e) {
    console.error("Failed to retrieve context PDF", e);
    return null;
  }
};

export const getTextEmbedding = async (text: string): Promise<number[] | undefined> => {
    try {
        // Only attempt cloud embedding if an API key is present
        if (!process.env.API_KEY || process.env.API_KEY === 'undefined') {
            throw new Error("No API Key");
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: [{ parts: [{ text }] }],
        });
        return response.embeddings[0].values;
    } catch (e) {
        // Only log warning if it's an actual failure, not just missing key
        if (process.env.API_KEY) {
            console.warn("Cloud embedding failed, falling back to local", e);
        }
        const local = await getLocalEmbedding(text);
        return local || undefined;
    }
}

export const generateBespokeSuggestions = async (content: string, ragEnabled: boolean = false): Promise<{label: string, icon: string, intent: string}[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = currentTier === 'pro' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const pdfContext = ragEnabled ? getContextPDF() : null;

    const parts: any[] = [];
    if (pdfContext) {
      parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfContext } });
      parts.push({ text: "Use the attached PDF as reference context." });
    }
    parts.push({ text: `Analyze this note and suggest 6 diverse, context-aware additions. NOTE: "${content}"` });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              icon: { type: Type.STRING },
              intent: { type: Type.STRING }
            },
            required: ["label", "icon", "intent"]
          }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to generate bespoke suggestions", e);
    return [
      { label: 'Summarize', icon: 'summarize', intent: 'Provide a concise summary of the points above.' },
      { label: 'Action Items', icon: 'checklist', intent: 'Extract actionable tasks from the text.' },
      { label: 'Elaborate', icon: 'add_circle', intent: 'Expand on the key concepts mentioned.' }
    ];
  }
};

export const processNoteWithAI = async (content: string, ragEnabled: boolean = false): Promise<AIReponse> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfContext = ragEnabled ? getContextPDF() : null;
    const modelName = currentTier === 'pro' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const embeddingPromise = getTextEmbedding(content);

    const parts: any[] = [];
    if (pdfContext) {
      parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfContext } });
      parts.push({ text: `Analyze the USER NOTE in the context of the attached PDF document.` });
    }

    parts.push({ text: `TAG LIBRARY: ${TAG_LIBRARY}` });
    parts.push({ text: `USER NOTE: "${content}"` });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        systemInstruction: `You are an automated Knowledge Engine Librarian. 
        Analyze the note and provide metadata using the provided TAG LIBRARY.
        
        RULES:
        - Category: One of: Thoughts, Ideas, Reminders, Coding, Projects, Lists, Research, Personal.
        - Headline: MAX 5 words.
        - Tags: 3-5 tags from library.
        
        OUTPUT FORMAT: JSON ONLY.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            headline: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["category", "headline", "tags"]
        }
      },
    });

    const embedding = await embeddingPromise;
    const result = JSON.parse(response.text || '{}');
    return {
      category: result.category || 'Thoughts',
      headline: result.headline || 'New Entry',
      tags: result.tags || [],
      embedding: embedding
    };
  } catch (error) {
    console.error("AI Processing failed:", error);
    throw error;
  }
};

export const performAISuggestion = async (content: string, intent: string, ragEnabled: boolean = false): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = currentTier === 'pro' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const pdfContext = ragEnabled ? getContextPDF() : null;

    const parts: any[] = [];
    if (pdfContext) {
      parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfContext } });
      parts.push({ text: "Reference context provided." });
    }
    parts.push({ text: `INSTRUCTION: ${intent}\nNOTE CONTENT: "${content}"` });
    
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        systemInstruction: `Provide addition to note based on instruction. Concatenated only. No intros.`
      }
    });
    
    return response.text?.trim() || "";
  } catch (e) {
    console.error("AI Suggestion failed", e);
    throw e;
  }
};

export const reformatNoteContent = async (content: string, ragEnabled: boolean = false): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfContext = ragEnabled ? getContextPDF() : null;
    const modelName = currentTier === 'pro' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const parts: any[] = [];
    if (pdfContext) {
      parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfContext } });
      parts.push({ text: "Use the attached PDF as the authoritative source." });
    }
    parts.push({ text: `ORIGINAL NOTE: "${content}"` });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        systemInstruction: `Reformat notes in authoritative, concise encyclopedic style. No markdown, single paragraph. AUTHORITATIVE tone.`
      }
    });
    return response.text || content;
  } catch (error) {
    console.error("Reformat failed", error);
    throw error;
  }
};
