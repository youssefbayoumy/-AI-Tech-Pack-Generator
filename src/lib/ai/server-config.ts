import 'server-only';

import { z } from 'zod';

import {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_REASONING_EFFORT,
  getOpenAiModel,
  type OpenAiModel,
} from './config';

export const DEFAULT_PROVIDER_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 12_000;

const positiveInteger = z.coerce.number().int().positive();

export interface OpenAiRuntimeConfiguration {
  apiKey: string;
  model: OpenAiModel;
  reasoningEffort: typeof DEFAULT_REASONING_EFFORT;
  timeoutMs: number;
  maxOutputTokens: number;
}

/** Thrown only on the server; its message is deliberately safe to return generically. */
export class MissingOpenAiConfigurationError extends Error {
  constructor() {
    super('OpenAI server configuration is missing. Set OPENAI_API_KEY before generating.');
    this.name = 'MissingOpenAiConfigurationError';
  }
}

export function getOpenAiRuntimeConfiguration(
  environment: Record<string, string | undefined> = process.env,
): OpenAiRuntimeConfiguration {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) throw new MissingOpenAiConfigurationError();

  return {
    apiKey,
    model: getOpenAiModel(environment),
    reasoningEffort: DEFAULT_REASONING_EFFORT,
    timeoutMs: positiveInteger.catch(DEFAULT_PROVIDER_TIMEOUT_MS).parse(environment.OPENAI_TIMEOUT_MS),
    maxOutputTokens: positiveInteger
      .catch(DEFAULT_MAX_OUTPUT_TOKENS)
      .parse(environment.OPENAI_MAX_OUTPUT_TOKENS),
  };
}

export { DEFAULT_OPENAI_MODEL };
