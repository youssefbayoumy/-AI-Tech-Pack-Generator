import { z } from 'zod';

export const openAiModelSchema = z.enum(['gpt-5.6-sol', 'gpt-5.6-terra']);
export type OpenAiModel = z.infer<typeof openAiModelSchema>;

export const DEFAULT_OPENAI_MODEL: OpenAiModel = 'gpt-5.6-sol';
export const DEFAULT_REASONING_EFFORT = 'medium' as const;
export const DEFAULT_OPENROUTER_MODEL = 'qwen/qwen2.5-vl-32b-instruct:free';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';
export const DEFAULT_GEMINI_THINKING_LEVEL = 'medium' as const;
export const geminiThinkingLevelSchema = z.enum(['minimal', 'low', 'medium', 'high']);
export type GeminiThinkingLevel = z.infer<typeof geminiThinkingLevelSchema>;

export const aiProviderSchema = z.enum(['openai', 'openrouter', 'gemini']);
export type AiProvider = z.infer<typeof aiProviderSchema>;

/** Server-only configuration for the future provider adapter. */
export function getOpenAiModel(environment: Record<string, string | undefined> = process.env): OpenAiModel {
  return openAiModelSchema.parse(environment.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL);
}

export function getAiProvider(environment: Record<string, string | undefined> = process.env): AiProvider {
  return aiProviderSchema.parse(environment.AI_PROVIDER ?? 'openai');
}

export function getOpenRouterModel(environment: Record<string, string | undefined> = process.env): string {
  return z.string().trim().min(1).parse(environment.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL);
}

export function getGeminiModel(environment: Record<string, string | undefined> = process.env): string {
  return z.string().trim().min(1).parse(environment.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL);
}
