import { GoogleGenAI, Type } from "@google/genai";
import { AIReponse, ModelTier } from "../types";
// @ts-ignore
import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;
env.remoteHost = 'https://huggingface.co';
env.remotePathTemplate = '{model}/resolve/{revision}/';

let currentTier: ModelTier = 'flash';
let localEmbedder: any = null;
let initializationPromise: Promise<any> | null = null;

export const setModelTier = (tier: ModelTier) => {
  currentTier = tier;
};

export const initLocalEmbedder = async (retries = 2) => {
  if (localEmbedder) return localEmbedder;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    let lastError: any = null;
    for (let i = 0; i <= retries; i++) {
      try {
        localEmbedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        return localEmbedder;
      } catch (e: any) {
        lastError = e;
        if (i < retries) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
    initializationPromise = null;
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
    return null;
  }
};

const VALID_CATEGORIES = [
  "Idea", "Reference", "List", "Project", "Goal", 
  "To-Do", "Urgent", "Work", "Personal", "Finance", 
  "Health", "Tech", "Journal", "Meeting", "Travel", 
  "Recipe", "Code", "Quote", "Review", "Archive"
];

const TAG_LIBRARY = `Work, Personal, Urgent, To-Do, Ideas, Goals, Project, Meeting, Finance, Health, Travel, Home, Shopping, Tech, Learning, Reference, Archive, Journal, Events, Family, Friends, Career, Education, Books, Movies, Music, Art, Design, Code, Marketing, Sales, Legal, Taxes, Bills, Recipes, Fitness, Meditation, Hobbies, Gaming, News, Politics, Science, History, Geography, Languages, DIY, Maintenance, Vehicles, Pets, Garden, Important, Later, Waiting, Research, Inspiration, Review, Draft, Final, Security`;

const getContextPDF = (): string | null => {
  try {
    return localStorage.getItem('note_forge_context_pdf');
  } catch (e) {
    return null;
  }
};

export const getTextEmbedding = async (text: string): Promise<number[] | undefined> => {
    try {
        if (!process.env.API_KEY || process.env.API_KEY === 'undefined') throw new Error("No API Key");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: [{ parts: [{ text }] }],
        });
        return response.embeddings[0].values;
    } catch (e) {
        const local = await getLocalEmbedding(text);
        return local || undefined;
    }
}

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

    parts.push({ text: `CURRENT TIME: ${new Date().toLocaleString()}\nALLOWED CATEGORIES: ${VALID_CATEGORIES.join(", ")}\nTAG LIBRARY: ${TAG_LIBRARY}\nUSER NOTE: "${content}"` });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        systemInstruction: `You are an automated Knowledge Engine Librarian. 
        Analyze the note and provide metadata.
        
        CRITICAL RULE: You MUST categorize the note into EXACTLY ONE of the provided ALLOWED CATEGORIES. 
        DO NOT invent new categories. If a note fits multiple, pick the most specific one. 
        If it fits none, use 'Journal' for thoughts or 'Reference' for facts.

        ROUTING RULES:
        - Intent:
           'task': Actionable content (buy, call, finish, do, remind).
           'reference': Archival content, definitions, long-form research.
           'ephemeral': Rapid logs, quick lists, grocery lists.
        - Calendar Detection: If the note contains time/date based language (e.g. 'tomorrow at 2pm', 'next Friday'), set calendarSync to true and extract eventDetails.

        OUTPUT FORMAT: JSON ONLY.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { 
              type: Type.STRING, 
              description: `Must be exactly one of: ${VALID_CATEGORIES.join(", ")}` 
            },
            headline: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            intent: { type: Type.STRING, description: "task, reference, or ephemeral" },
            calendarSync: { type: Type.BOOLEAN },
            eventDetails: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                start: { type: Type.STRING, description: "ISO 8601 string" },
                end: { type: Type.STRING, description: "ISO 8601 string, default 1 hour after start" },
                description: { type: Type.STRING }
              }
            }
          },
          required: ["category", "headline", "tags", "intent"]
        }
      },
    });

    const embedding = await embeddingPromise;
    const result = JSON.parse(response.text || '{}');
    return {
      category: result.category || 'Journal',
      headline: result.headline || 'New Entry',
      tags: result.tags || [],
      intent: result.intent || 'reference',
      calendarSync: result.calendarSync || false,
      eventDetails: result.eventDetails,
      embedding: embedding
    };
  } catch (error) {
    console.error("AI Processing failed:", error);
    throw error;
  }
};

export const generateBespokeSuggestions = async (content: string, ragEnabled: boolean = false): Promise<{label: string, icon: string, intent: string}[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = currentTier === 'pro' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const pdfContext = ragEnabled ? getContextPDF() : null;
    const parts: any[] = [];
    if (pdfContext) parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfContext } });
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
    return [
      { label: 'Summarize', icon: 'summarize', intent: 'Provide a concise summary.' },
      { label: 'Action Items', icon: 'checklist', intent: 'Extract actionable tasks.' },
      { label: 'Elaborate', icon: 'add_circle', intent: 'Expand key concepts.' }
    ];
  }
};

export const performAISuggestion = async (content: string, intent: string, ragEnabled: boolean = false): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = currentTier === 'pro' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const pdfContext = ragEnabled ? getContextPDF() : null;
    const parts: any[] = [];
    if (pdfContext) parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfContext } });
    parts.push({ text: `INSTRUCTION: ${intent}\nNOTE CONTENT: "${content}"` });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: { systemInstruction: `Provide addition to note based on instruction. Concatenated only. No intros.` }
    });
    return response.text?.trim() || "";
  } catch (e) {
    throw e;
  }
};

export const reformatNoteContent = async (content: string, ragEnabled: boolean = false): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const pdfContext = ragEnabled ? getContextPDF() : null;
    const modelName = currentTier === 'pro' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const parts: any[] = [];
    if (pdfContext) parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfContext } });
    parts.push({ text: `ORIGINAL NOTE: "${content}"` });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: { systemInstruction: `Reformat notes in authoritative, concise encyclopedic style. No markdown, single paragraph.` }
    });
    return response.text || content;
  } catch (error) {
    throw error;
  }
};