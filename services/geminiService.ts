import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize the client. 
// Note: In a production app, ensure API_KEY is securely handled.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a chat response using gemini-3-pro-preview
 */
export const generateChatResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string
): Promise<string> => {
  try {
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
  } catch (error) {
    console.error("Chat Error:", error);
    throw new Error("Failed to generate chat response.");
  }
};

/**
 * Generates an image using imagen-4.0-generate-001
 */
export const generateCreativeImage = async (prompt: string): Promise<string> => {
  try {
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
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw new Error("Failed to generate image.");
  }
};