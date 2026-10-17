// Anthropic provider — thin adapter, implemented but NOT tested (no key available). Server-only.
import type { LiveProvider, ProviderRequest } from './types';

export function anthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY || undefined;
}

export const anthropicProvider: LiveProvider = {
  name: 'anthropic',
  async generate(req: ProviderRequest): Promise<string> {
    const apiKey = anthropicKey();
    if (!apiKey) throw new Error('missing Anthropic API key');
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const content: Array<Record<string, unknown>> = [];
    if (req.file) {
      const data = Buffer.from(req.file.data).toString('base64');
      content.push(
        req.file.mimeType === 'application/pdf'
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
          : { type: 'image', source: { type: 'base64', media_type: req.file.mimeType, data } },
      );
    }
    content.push({ type: 'text', text: req.user });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg: any = await client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      temperature: 0,
      system: req.system,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: content as any }],
    });
    const text = (msg?.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');
    if (!text.trim()) throw new Error('empty response from Anthropic');
    return text;
  },
};
