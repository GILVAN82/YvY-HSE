import path from 'node:path';
import dotenv from 'dotenv';

export const BACKEND_ENV_PATH = path.resolve(__dirname, '../../.env');

export type BackendEnvironmentStatus = {
  envPath: string;
  fileLoaded: boolean;
  openAIConfigured: boolean;
};

/**
 * Loads backend/.env from a deterministic project-relative path.
 * dotenv's default override=false preserves values injected by the process/runtime.
 */
export function loadBackendEnvironment(
  processEnv: NodeJS.ProcessEnv = process.env,
  envPath = BACKEND_ENV_PATH
): BackendEnvironmentStatus {
  // An inherited empty value is not configuration and must not suppress a valid local fallback.
  // Non-empty injected values remain authoritative because dotenv runs with override=false.
  if (!processEnv.OPENAI_API_KEY?.trim()) delete processEnv.OPENAI_API_KEY;
  const result = dotenv.config({ path: envPath, override: false, processEnv: processEnv as Record<string, string> });
  return {
    envPath,
    fileLoaded: !result.error,
    openAIConfigured: Boolean(processEnv.OPENAI_API_KEY?.trim()),
  };
}

export function requireOpenAIConfiguration(processEnv: NodeJS.ProcessEnv = process.env): void {
  if (!processEnv.OPENAI_API_KEY?.trim()) {
    throw new Error('OpenAI embedding provider is not configured');
  }
}
