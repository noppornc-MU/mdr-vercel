// Single LLM adapter: generateJson({system, user, image?, schema}) — server-only.
// Provider selection (never logs keys):
//   task mode  : EXTRACT_MODE (extract) / AI_MODE (consult) = live | cached
//                unset → live if a key/credentials exist, otherwise cached
//   live vendor: LLM_PROVIDER = gemini (default) | anthropic | bedrock ; model: LLM_MODEL
import { anthropicKey, anthropicProvider } from './anthropic';
import { bedrockConfigured, bedrockProvider } from './bedrock';
import { runCached, type CachedResponder } from './cached';
import { geminiKey, geminiProvider } from './gemini';
import { LlmError, type LiveProvider, type LlmFile, type LlmTask, type ProviderName, type SchemaLike } from './types';

export { LlmError } from './types';
export type { LlmFile, LlmTask, ProviderName, SchemaLike } from './types';

const DEFAULT_MODELS: Record<Exclude<ProviderName, 'cached'>, string> = {
  gemini: 'gemini-2.5-flash',
  anthropic: 'claude-sonnet-4-5',
  bedrock: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
};

const LIVE: Record<Exclude<ProviderName, 'cached'>, LiveProvider> = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
  bedrock: bedrockProvider,
};

function liveVendor(): Exclude<ProviderName, 'cached'> {
  const v = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  return v === 'anthropic' || v === 'bedrock' ? v : 'gemini';
}

function hasCredentials(vendor: Exclude<ProviderName, 'cached'>): boolean {
  if (vendor === 'gemini') return Boolean(geminiKey());
  if (vendor === 'anthropic') return Boolean(anthropicKey());
  return bedrockConfigured();
}

export interface ResolvedProvider {
  name: ProviderName;
  model: string;
  mode: 'live' | 'cached';
}

export function resolveProvider(task: LlmTask, override?: ProviderName): ResolvedProvider {
  if (override === 'cached') return { name: 'cached', model: 'cached-template', mode: 'cached' };
  const vendor = override ?? liveVendor();
  const modeEnv = (task === 'extract' ? process.env.EXTRACT_MODE : process.env.AI_MODE)?.toLowerCase();
  const live = override ? true : modeEnv === 'live' ? true : modeEnv === 'cached' ? false : hasCredentials(vendor);
  if (!live) return { name: 'cached', model: 'cached-template', mode: 'cached' };
  return { name: vendor, model: process.env.LLM_MODEL || DEFAULT_MODELS[vendor], mode: 'live' };
}

/** Pull a JSON object out of model text (handles ```json fences / stray prose). */
export function extractJsonText(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new LlmError('BAD_JSON', 'โมเดลไม่ได้ตอบเป็น JSON');
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new LlmError('BAD_JSON', 'โมเดลตอบ JSON ไม่ถูกต้อง');
  }
}

function scrub(message: string): string {
  let m = message;
  for (const k of [geminiKey(), anthropicKey(), process.env.AWS_SECRET_ACCESS_KEY]) {
    if (k) m = m.split(k).join('***');
  }
  return m.slice(0, 300);
}

export interface GenerateJsonOptions<T> {
  system: string;
  user: string;
  image?: LlmFile;
  schema: SchemaLike<T>;
  provider?: ProviderName;
  task?: LlmTask;
  /** Deterministic responder used when the resolved provider is "cached". */
  cached?: CachedResponder;
  maxTokens?: number;
}

export interface GenerateJsonResult<T> {
  data: T;
  provider: ProviderName;
  model: string;
  mode: 'live' | 'cached';
}

export async function generateJsonWithMeta<T>(opts: GenerateJsonOptions<T>): Promise<GenerateJsonResult<T>> {
  const resolved = resolveProvider(opts.task ?? 'consult', opts.provider);
  let raw: unknown;
  if (resolved.name === 'cached') {
    raw = await runCached(opts.cached);
  } else {
    const vendor = resolved.name;
    if (!hasCredentials(vendor) && vendor !== 'bedrock') {
      throw new LlmError('NO_KEY', `ยังไม่ได้ตั้งค่า API key สำหรับ ${vendor}`);
    }
    let text: string;
    try {
      text = await LIVE[vendor].generate({
        system: opts.system,
        user: opts.user,
        file: opts.image,
        model: resolved.model,
        maxTokens: opts.maxTokens ?? 4096,
      });
    } catch (e) {
      throw new LlmError('PROVIDER_ERROR', `เรียกโมเดล ${vendor} ไม่สำเร็จ: ${scrub(e instanceof Error ? e.message : String(e))}`);
    }
    raw = extractJsonText(text);
  }
  const parsed = opts.schema.safeParse(raw);
  if (!parsed.success) throw new LlmError('SCHEMA', 'ผลลัพธ์ไม่ตรงตาม schema');
  return { data: parsed.data as T, provider: resolved.name, model: resolved.model, mode: resolved.mode };
}

export async function generateJson<T>(opts: GenerateJsonOptions<T>): Promise<T> {
  return (await generateJsonWithMeta(opts)).data;
}
