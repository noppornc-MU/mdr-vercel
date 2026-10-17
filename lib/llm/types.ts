// Shared types for the LLM adapter (server-only).

export type ProviderName = 'gemini' | 'anthropic' | 'bedrock' | 'cached';
export type LlmTask = 'extract' | 'consult';

/** Binary attachment (image or PDF) sent to vision-capable providers. */
export interface LlmFile {
  data: Uint8Array;
  mimeType: string; // image/png | image/jpeg | application/pdf
}

/** Minimal schema contract (satisfied by any Zod schema). */
export interface SchemaLike<T> {
  safeParse(data: unknown): { success: boolean; data?: T; error?: unknown };
}

export interface ProviderRequest {
  system: string;
  user: string;
  file?: LlmFile;
  model: string;
  maxTokens: number;
}

export interface LiveProvider {
  name: Exclude<ProviderName, 'cached'>;
  /** Returns raw model text (expected to be JSON). */
  generate(req: ProviderRequest): Promise<string>;
}

export type LlmErrorCode = 'NO_KEY' | 'CACHED_MISS' | 'PROVIDER_ERROR' | 'BAD_JSON' | 'SCHEMA';

export class LlmError extends Error {
  code: LlmErrorCode;
  constructor(code: LlmErrorCode, message: string) {
    super(message);
    this.name = 'LlmError';
    this.code = code;
  }
}
