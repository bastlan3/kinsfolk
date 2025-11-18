import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getApiKey = (): string | undefined => {
  // 1. Check Local Storage (User entered)
  const storedKey = localStorage.getItem('gemini_api_key');
  if (storedKey) return storedKey;

  // 2. Check Environment Variable (safely for browser)
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    // @ts-ignore
    return process.env.API_KEY;
  }

  return undefined;
};

export const hasApiKey = (): boolean => {
  return !!getApiKey();
};

export const setUserApiKey = (key: string) => {
  localStorage.setItem('gemini_api_key', key);
};

const getClient = () => {
  const key = getApiKey();
  if (!key) {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({ apiKey: key });
};

/**
 * Generates a chat response using gemini-3-pro-preview
 */
export const generateChatResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string
): Promise<string> => {
  try {
    const ai = getClient();
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      history: history,
      config: {
        temperature: 0.7,
        systemInstruction: "You are KinBot, a friendly family memory assistant. You help users organize their photos, suggest caption ideas, and encourage them to share memories with their loved ones. Keep responses warm, encouraging, and concise.",
      },
    });

    const result: GenerateContentResponse = await chat.sendMessage({ message });
    return result.text || "I'm having trouble finding the right words right now.";
  } catch (error: any) {
    console.error("Chat Error:", error);
    if (error.message === "MISSING_API_KEY") {
      throw error;
    }
    throw new Error("Failed to generate chat response.");
  }
};

/**
 * Generates an image using imagen-4.0-generate-001
 */
export const generateCreativeImage = async (prompt: string): Promise<string> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    throw new Error("No image generated");
  } catch (error: any) {
    console.error("Image Gen Error:", error);
    if (error.message === "MISSING_API_KEY") {
      throw error;
    }
    throw new Error("Failed to generate image.");
  }
};