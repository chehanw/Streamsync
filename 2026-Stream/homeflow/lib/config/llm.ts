/**
 * LLM Configuration & Migration Scaffolding
 *
 * MIGRATION NOTE:
 * ─────────────────────────────────────────────────────────────────────
 * OpenAI API keys must NOT live in the client bundle for production.
 * Production deployment requires server-side key storage via
 * Firebase Secret Manager (or equivalent).
 *
 * This flag system exists to make migration seamless:
 *   1. Set EXPO_PUBLIC_USE_BACKEND_LLM=false during development
 *      → Client calls OpenAI directly (dev-only convenience).
 *   2. Set EXPO_PUBLIC_USE_BACKEND_LLM=true for production
 *      → Client calls /api/llm/chat (Firebase Cloud Function).
 *   3. Implement the Cloud Function, store the key in Secret Manager,
 *      and remove EXPO_PUBLIC_OPENAI_API_KEY from .env entirely.
 * ─────────────────────────────────────────────────────────────────────
 */

import type { ChatProvider } from '@spezivibe/chat';

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

/**
 * When true, LLM requests are routed to a backend endpoint instead of
 * calling OpenAI directly from the client.
 */
export const USE_BACKEND_LLM =
  process.env.EXPO_PUBLIC_USE_BACKEND_LLM === 'true';

/**
 * Placeholder endpoint for the future Firebase Cloud Function.
 * TODO: Once Firebase backend is set up, point this to the real
 * Cloud Function / Cloud Run URL.
 */
export const BACKEND_LLM_ENDPOINT =
  process.env.EXPO_PUBLIC_BACKEND_LLM_URL || '/api/llm/chat';

// ---------------------------------------------------------------------------
// Client-side API key (development only)
// ---------------------------------------------------------------------------

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

// ---------------------------------------------------------------------------
// Dev warning
// ---------------------------------------------------------------------------

if (__DEV__ && OPENAI_API_KEY && !USE_BACKEND_LLM) {
  console.warn(
    'WARNING: OpenAI key is being used client-side. ' +
      'This must be migrated to Firebase before production.',
  );
}

// ---------------------------------------------------------------------------
// Provider helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ChatProvider config for the current environment.
 *
 * TODO: Once Firebase backend is set up, move OpenAI calls to a Cloud
 * Function or Cloud Run endpoint and remove client-side API key usage.
 *
 * When USE_BACKEND_LLM is true this returns null — callers should
 * use `BACKEND_LLM_ENDPOINT` via fetch instead.
 */
export function getClientLLMProvider(
  model?: string,
): ChatProvider | null {
  if (USE_BACKEND_LLM) {
    // Backend mode: callers should use BACKEND_LLM_ENDPOINT instead.
    return null;
  }

  if (!OPENAI_API_KEY) {
    return null;
  }

  return {
    type: 'openai',
    apiKey: OPENAI_API_KEY,
    ...(model ? { model } : {}),
  };
}

/**
 * Whether an LLM provider is available (either client-side key or backend).
 */
export function isLLMAvailable(): boolean {
  return USE_BACKEND_LLM || !!OPENAI_API_KEY;
}
