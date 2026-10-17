// AWS Bedrock provider (Converse API) — thin adapter, implemented but NOT tested. Server-only.
// Credentials come from the default AWS credential chain (env / profile); never logged.
import type { LiveProvider, ProviderRequest } from './types';

export function bedrockConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_BEARER_TOKEN_BEDROCK,
  );
}

export const bedrockProvider: LiveProvider = {
  name: 'bedrock',
  async generate(req: ProviderRequest): Promise<string> {
    const { BedrockRuntimeClient, ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const content: Array<Record<string, unknown>> = [];
    if (req.file) {
      const bytes = req.file.data;
      if (req.file.mimeType === 'application/pdf') {
        content.push({ document: { format: 'pdf', name: 'report', source: { bytes } } });
      } else {
        content.push({ image: { format: req.file.mimeType === 'image/png' ? 'png' : 'jpeg', source: { bytes } } });
      }
    }
    content.push({ text: req.user });
    const cmd = new ConverseCommand({
      modelId: req.model,
      system: [{ text: req.system }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: content as any }],
      inferenceConfig: { maxTokens: req.maxTokens, temperature: 0 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = await client.send(cmd);
    const text = (out?.output?.message?.content ?? [])
      .map((c: { text?: string }) => c.text ?? '')
      .join('');
    if (!text.trim()) throw new Error('empty response from Bedrock');
    return text;
  },
};
