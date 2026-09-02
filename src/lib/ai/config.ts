import { z } from 'zod';

export const openAiModelSchema = z.enum(['gpt-5.6-sol', 'gpt-5.6-terra']);
export type OpenAiModel = z.infer<typeof openAiModelSchema>;

export const DEFAULT_OPENAI_MODEL: OpenAiModel = 'gpt-5.6-sol';
export const DEFAULT_REASONING_EFFORT = 'medium' as const;

/** Server-only configuration for the future provider adapter. */
export function getOpenAiModel(environment: Record<string, string | undefined> = process.env): OpenAiModel {
  return openAiModelSchema.parse(environment.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL);
}
