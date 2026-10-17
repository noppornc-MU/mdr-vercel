// Gemini provider (default live provider). Server-only. Never log the key.
import type { LiveProvider, ProviderRequest } from './types';

export function geminiKey(): string | undefined {
  return process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export const geminiProvider: LiveProvider = {
  name: 'gemini',
  async generate(req: ProviderRequest): Promise<string> {
    const apiKey = geminiKey();
    if (!apiKey) throw new Error('missing Gemini API key');
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const parts: Array<Record<string, unknown>> = [];
    if (req.file) {
      parts.push({ inlineData: { mimeType: req.file.mimeType, data: Buffer.from(req.file.data).toString('base64') } });
    }
    parts.push({ text: req.user });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await ai.models.generateContent({
      model: req.model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contents: [{ role: 'user', parts }] as any,
      config: {
        systemInstruction: req.system,
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: req.maxTokens,
      },
    });
    const text: unknown = typeof res?.text === 'function' ? res.text() : res?.text;
    if (typeof text !== 'string' || !text.trim()) throw new Error('empty response from Gemini');
    return text;
  },
};
