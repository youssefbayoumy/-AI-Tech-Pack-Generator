import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GEMINI_MAX_OUTPUT_TOKENS,
  DEFAULT_GEMINI_TIMEOUT_MS,
  getAiRuntimeConfiguration,
  getGeminiRuntimeConfiguration,
  MissingGeminiConfigurationError,
} from '../src/lib/ai/runtime-config';
import { GeminiTechPackProvider } from '../src/lib/ai/gemini/adapter';
import { createTechPackProvider } from '../src/lib/ai/provider/create';

describe('Gemini runtime configuration', () => {
  it('requires a Gemini key only when Gemini is selected for an invocation', () => {
    expect(() => getGeminiRuntimeConfiguration({})).toThrow(MissingGeminiConfigurationError);
    expect(() => getAiRuntimeConfiguration({ AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'key' })).not.toThrow();
  });

  it('parses Gemini settings with server-only defaults', () => {
    const configuration = getAiRuntimeConfiguration({
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'test-key',
    });
    expect(configuration).toEqual({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-3.7-flash',
      thinkingLevel: 'medium',
      timeoutMs: DEFAULT_GEMINI_TIMEOUT_MS,
      maxOutputTokens: DEFAULT_GEMINI_MAX_OUTPUT_TOKENS,
    });
    expect(createTechPackProvider(configuration)).toBeInstanceOf(GeminiTechPackProvider);
  });
});
