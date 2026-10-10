import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';

export interface ModelOption {
  id: string;
  label: string;
}

export interface ProviderConfig {
  id: string;
  label: string;
  /** Env var that must be set for this provider to be usable, or null if none is required (e.g. local Ollama). */
  envKey: string | null;
  models: ModelOption[];
  /** Accepts any model id typed by the user, instead of only the fixed `models` list above. */
  allowCustomModel?: boolean;
  resolveModel: (modelId: string) => LanguageModel;
}

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

export const PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    envKey: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    ],
    resolveModel: (modelId) => anthropic(modelId as Parameters<typeof anthropic>[0]),
  },
  openai: {
    id: 'openai',
    label: 'OpenAI (GPT)',
    envKey: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-5.5', label: 'GPT-5.5' },
      { id: 'gpt-5.1', label: 'GPT-5.1' },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
    ],
    // Create lazily so long-running/dev server processes cannot capture environment
    // configuration before env.bootstrap has completed.
    resolveModel: (modelId) => createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelId),
  },
  google: {
    id: 'google',
    label: 'Google (Gemini)',
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ],
    resolveModel: (modelId) => google(modelId as Parameters<typeof google>[0]),
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (modelos locais)',
    envKey: null,
    allowCustomModel: true,
    models: [
      { id: 'llama3.1', label: 'Llama 3.1' },
      { id: 'qwen2.5', label: 'Qwen 2.5' },
      { id: 'mistral', label: 'Mistral' },
    ],
    resolveModel: (modelId) => ollama(modelId),
  },
};

/** Thrown when a provider exists but is not usable (no key, service down).
 *  Distinct from an invalid request so the HTTP layer can answer 503, not 400. */
export class ProviderUnavailableError extends Error {}

export function isProviderAvailable(providerId: string): boolean {
  const p = PROVIDERS[providerId];
  if (!p) return false;
  if (!p.envKey) return true;
  return !!process.env[p.envKey];
}

/**
 * Resolves a (provider, model) pair to a Vercel AI SDK LanguageModel, after validating
 * both against a server-side allowlist. Never trust a raw model string from the client
 * for cloud providers — it could trigger unexpected cost or call an unintended model.
 */
export function resolveModel(providerId: string, modelId: string): LanguageModel {
  const p = PROVIDERS[providerId];
  if (!p) {
    throw new Error(`Provedor desconhecido: "${providerId}"`);
  }
  if (!isProviderAvailable(p.id)) {
    throw new ProviderUnavailableError(
      p.envKey
        ? `Provider "${p.label}" is not configured on the server.`
        : `Provider "${p.label}" is not available.`
    );
  }

  if (p.allowCustomModel) {
    if (!modelId || !/^[a-zA-Z0-9._:\-/]{1,100}$/.test(modelId)) {
      throw new Error('Invalid model name.');
    }
    return p.resolveModel(modelId);
  }

  const known = p.models.some((m) => m.id === modelId);
  if (!known) {
    throw new Error(`Model "${modelId}" is not allowed for provider "${p.label}".`);
  }
  return p.resolveModel(modelId);
}

/** Safe-for-client view: never includes API keys, only which providers/models are usable. */
export function listProvidersForClient() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    available: isProviderAvailable(p.id),
    models: p.models,
    allowCustomModel: !!p.allowCustomModel,
  }));
}
