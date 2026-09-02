import 'server-only';

import { OpenAiTechPackProvider } from '../openai/adapter';
import { GeminiTechPackProvider } from '../gemini/adapter';
import { OpenRouterTechPackProvider } from '../openrouter/adapter';
import type { AiRuntimeConfiguration } from '../server-config';
import type { TechPackProvider } from './types';

/** Creates exactly the configured provider. It never performs cross-provider fallback. */
export function createTechPackProvider(configuration: AiRuntimeConfiguration): TechPackProvider {
  if (configuration.provider === 'openai') return new OpenAiTechPackProvider(configuration);
  if (configuration.provider === 'openrouter') return new OpenRouterTechPackProvider(configuration);
  return new GeminiTechPackProvider(configuration);
}
