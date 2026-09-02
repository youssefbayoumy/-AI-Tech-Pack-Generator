import 'server-only';

import {
  getAiRuntimeConfiguration as parseAiRuntimeConfiguration,
  getGeminiRuntimeConfiguration as parseGeminiRuntimeConfiguration,
  getOpenAiRuntimeConfiguration as parseOpenAiRuntimeConfiguration,
  getOpenRouterRuntimeConfiguration as parseOpenRouterRuntimeConfiguration,
} from './runtime-config';

export {
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_GEMINI_MAX_OUTPUT_TOKENS,
  DEFAULT_GEMINI_TIMEOUT_MS,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENROUTER_MAX_OUTPUT_TOKENS,
  DEFAULT_OPENROUTER_TIMEOUT_MS,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  MissingOpenAiConfigurationError,
  MissingGeminiConfigurationError,
  MissingOpenRouterConfigurationError,
} from './runtime-config';
export type {
  AiRuntimeConfiguration,
  GeminiRuntimeConfiguration,
  OpenAiRuntimeConfiguration,
  OpenRouterRuntimeConfiguration,
} from './runtime-config';

/** Server-only environment access; parsing itself remains deterministic and testable. */
export function getOpenAiRuntimeConfiguration() {
  return parseOpenAiRuntimeConfiguration(process.env);
}

export function getOpenRouterRuntimeConfiguration() {
  return parseOpenRouterRuntimeConfiguration(process.env);
}

export function getGeminiRuntimeConfiguration() {
  return parseGeminiRuntimeConfiguration(process.env);
}

/** Selects only the configured server provider; there is intentionally no fallback. */
export function getAiRuntimeConfiguration() {
  return parseAiRuntimeConfiguration(process.env);
}
