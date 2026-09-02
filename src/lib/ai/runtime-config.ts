import { z } from 'zod';

import {
  getAiProvider,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_GEMINI_THINKING_LEVEL,
  geminiThinkingLevelSchema,
  getOpenAiModel,
  getGeminiModel,
  getOpenRouterModel,
  type AiProvider,
  type GeminiThinkingLevel,
  type OpenAiModel,
} from './config';

export const DEFAULT_PROVIDER_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 12_000;
export const DEFAULT_OPENROUTER_TIMEOUT_MS = 180_000;
export const DEFAULT_OPENROUTER_MAX_OUTPUT_TOKENS = 32_000;
export const DEFAULT_GEMINI_TIMEOUT_MS = 180_000;
export const DEFAULT_GEMINI_MAX_OUTPUT_TOKENS = 32_000;

const positiveInteger = z.coerce.number().int().positive();

export interface OpenAiRuntimeConfiguration {
  provider: 'openai';
  apiKey: string;
  model: OpenAiModel;
  reasoningEffort: typeof DEFAULT_REASONING_EFFORT;
  timeoutMs: number;
  maxOutputTokens: number;
}

export interface OpenRouterRuntimeConfiguration {
  provider: 'openrouter';
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

export interface GeminiRuntimeConfiguration {
  provider: 'gemini';
  apiKey: string;
  model: string;
  thinkingLevel: GeminiThinkingLevel;
  timeoutMs: number;
  maxOutputTokens: number;
}

export type AiRuntimeConfiguration = OpenAiRuntimeConfiguration | OpenRouterRuntimeConfiguration | GeminiRuntimeConfiguration;

/** Thrown only on the server; its message is deliberately safe to return generically. */
export class MissingOpenAiConfigurationError extends Error {
  constructor() {
    super('OpenAI server configuration is missing. Set OPENAI_API_KEY before generating.');
    this.name = 'MissingOpenAiConfigurationError';
  }
}

/** Thrown only on the server; it does not include a secret. */
export class MissingOpenRouterConfigurationError extends Error {
  constructor() {
    super('OpenRouter server configuration is missing. Set OPENROUTER_API_KEY before generating.');
    this.name = 'MissingOpenRouterConfigurationError';
  }
}

/** Thrown only when a Gemini generation is actually selected and invoked. */
export class MissingGeminiConfigurationError extends Error {
  constructor() {
    super('Gemini server configuration is missing. Set GEMINI_API_KEY before generating.');
    this.name = 'MissingGeminiConfigurationError';
  }
}

export function getOpenAiRuntimeConfiguration(
  environment: Record<string, string | undefined>,
): OpenAiRuntimeConfiguration {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) throw new MissingOpenAiConfigurationError();

  return {
    provider: 'openai',
    apiKey,
    model: getOpenAiModel(environment),
    reasoningEffort: DEFAULT_REASONING_EFFORT,
    timeoutMs: positiveInteger.catch(DEFAULT_PROVIDER_TIMEOUT_MS).parse(environment.OPENAI_TIMEOUT_MS),
    maxOutputTokens: positiveInteger
      .catch(DEFAULT_MAX_OUTPUT_TOKENS)
      .parse(environment.OPENAI_MAX_OUTPUT_TOKENS),
  };
}

export function getOpenRouterRuntimeConfiguration(
  environment: Record<string, string | undefined>,
): OpenRouterRuntimeConfiguration {
  const apiKey = environment.OPENROUTER_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) throw new MissingOpenRouterConfigurationError();

  return {
    provider: 'openrouter',
    apiKey,
    model: getOpenRouterModel(environment),
    timeoutMs: positiveInteger
      .catch(DEFAULT_OPENROUTER_TIMEOUT_MS)
      .parse(environment.OPENROUTER_TIMEOUT_MS),
    maxOutputTokens: positiveInteger
      .catch(DEFAULT_OPENROUTER_MAX_OUTPUT_TOKENS)
      .parse(environment.OPENROUTER_MAX_OUTPUT_TOKENS),
  };
}

export function getGeminiRuntimeConfiguration(
  environment: Record<string, string | undefined>,
): GeminiRuntimeConfiguration {
  const apiKey = environment.GEMINI_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) throw new MissingGeminiConfigurationError();

  return {
    provider: 'gemini',
    apiKey,
    model: getGeminiModel(environment),
    thinkingLevel: geminiThinkingLevelSchema
      .catch(DEFAULT_GEMINI_THINKING_LEVEL)
      .parse(environment.GEMINI_THINKING_LEVEL),
    timeoutMs: positiveInteger.catch(DEFAULT_GEMINI_TIMEOUT_MS).parse(environment.GEMINI_TIMEOUT_MS),
    maxOutputTokens: positiveInteger
      .catch(DEFAULT_GEMINI_MAX_OUTPUT_TOKENS)
      .parse(environment.GEMINI_MAX_OUTPUT_TOKENS),
  };
}

/** Selects only the configured provider; there is intentionally no fallback. */
export function getAiRuntimeConfiguration(
  environment: Record<string, string | undefined>,
): AiRuntimeConfiguration {
  const provider: AiProvider = getAiProvider(environment);
  if (provider === 'openai') return getOpenAiRuntimeConfiguration(environment);
  if (provider === 'openrouter') return getOpenRouterRuntimeConfiguration(environment);
  return getGeminiRuntimeConfiguration(environment);
}

export { DEFAULT_OPENAI_MODEL };
