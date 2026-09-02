import { z } from 'zod';

import { techPackContentSchema } from '../../domain/tech-pack';

export const TECH_PACK_STRUCTURED_OUTPUT_NAME = 'tech_pack_content' as const;

/**
 * This is generated from the canonical, metadata-free content schema. It is
 * intentionally not a hand-maintained second schema. The future Responses API
 * adapter should pass it as `text.format` with no tools.
 */
export const techPackContentJsonSchema = z.toJSONSchema(techPackContentSchema);

export const techPackStructuredOutputFormat = {
  type: 'json_schema' as const,
  name: TECH_PACK_STRUCTURED_OUTPUT_NAME,
  strict: true,
  schema: techPackContentJsonSchema,
};
