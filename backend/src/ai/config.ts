/**
 * Runtime configuration for the agent layer. Validated once at startup so a typo in
 * .env fails loudly instead of silently changing behaviour at the first request.
 */

export type Orchestrator = 'legacy' | 'langgraph';

const ORCHESTRATORS: Orchestrator[] = ['legacy', 'langgraph'];

export class ConfigError extends Error {}

/** Reads and validates AI_ORCHESTRATOR. Defaults to 'langgraph'. */
export function readOrchestrator(env: NodeJS.ProcessEnv = process.env): Orchestrator {
  const raw = (env.AI_ORCHESTRATOR ?? 'langgraph').trim().toLowerCase();
  if (!ORCHESTRATORS.includes(raw as Orchestrator)) {
    throw new ConfigError(
      `AI_ORCHESTRATOR inválido: "${env.AI_ORCHESTRATOR}". Valores permitidos: ${ORCHESTRATORS.join(' | ')}.`
    );
  }
  return raw as Orchestrator;
}

/**
 * Origins allowed to call the API. Comma-separated in CORS_ORIGINS; falls back to the
 * local Angular dev server. CORS is not authentication — it only stops a browser on
 * another origin from using a logged-in session, and there are no sessions yet.
 */
export function readCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.CORS_ORIGINS?.trim();
  if (!raw) return ['http://localhost:4200', 'http://127.0.0.1:4200'];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Whether write endpoints (POST/PUT/DELETE on /api/data and /api/projects) are open.
 * There is no authentication yet, so they are CLOSED unless explicitly enabled for
 * local development. See docs/limitations.md.
 */
export function readWritesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.ALLOW_UNAUTHENTICATED_WRITES ?? '').trim().toLowerCase() === 'true';
}

/** Hard ceiling on agent reasoning steps — bounds both latency and cost. */
export const MAX_AGENT_STEPS = 5;

/** Wall-clock limit for a single model call. */
export const MODEL_TIMEOUT_MS = 60_000;

/** Largest accepted chat message. */
export const MAX_MESSAGE_LENGTH = 4000;

/** How many past turns are replayed into the model. */
export const MAX_HISTORY_TURNS = 30;

/** Largest accepted JSON body. */
export const MAX_BODY_SIZE = '256kb';
