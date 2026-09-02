import { z } from 'zod';

/** Gemini's model-facing contract is deliberately not the canonical domain schema. */
const nullableString = z.string().max(2_000).nullable().optional();
const nullableNumber = z.number().finite().nullable().optional();
const requiredString = z.string().max(2_000);
const requiredNullableString = z.string().max(2_000).nullable();
const requiredNullableNumber = z.number().finite().nullable();
const draftEvidenceSchema = z.object({
  path: z.string().max(240),
  source: z.enum(['buyer', 'visual_inference', 'ai_assumption', 'not_provided']),
  confirmationRequired: z.boolean().optional(),
  approximate: z.boolean().optional(),
  detail: nullableString,
  question: nullableString,
});
export const geminiTechPackDraftSchema = z.object({
  product: z.object({
    name: nullableString,
    category: nullableString,
    description: requiredString,
    intendedUse: requiredString,
    reversible: z.boolean().nullable().optional(),
  }),

  bom: z.array(z.object({
    id: nullableString,
    component: requiredString,
    placement: nullableString,
    material: requiredNullableString,
    composition: nullableString,
    specification: nullableString,
    gsm: z.union([
      z.number().finite(),
      z.string().max(80),
    ]).nullable().optional(),
    gsmApproximate: z.boolean().optional(),
    color: nullableString,
    quantity: nullableNumber,
    unit: nullableString,
    notes: nullableString,
  })).min(1),

  measurements: z.object({
    unit: z.enum(['mm', 'cm', 'in']),

    sizes: z.array(
      z.string().max(80).nullable()
    ).min(3),

    points: z.array(z.object({
      id: nullableString,
      name: requiredString,
      instruction: nullableString,

      values: z.array(
        requiredNullableNumber
      ).min(3),

      tolerance: nullableNumber,
    })).min(1),
  }),

  construction: z.array(z.object({
    id: nullableString,
    order: z.number().int().positive().optional(),
    area: nullableString,
    instruction: requiredString,
    notes: nullableString,
  })).min(1),

  colorConfiguration: z.object({
    type: z.enum(['reversible', 'conventional']),
    sideA: requiredNullableString,
    sideB: requiredNullableString,
  }),

  evidence: z.array(draftEvidenceSchema).min(1),
});
export type GeminiTechPackDraft = z.infer<typeof geminiTechPackDraftSchema>;

type JsonSchema = Record<string, unknown>;
const nullable = (type: string): JsonSchema => ({ anyOf: [{ type }, { type: 'null' }] });
const nullableNumberSchema = (): JsonSchema => ({ anyOf: [{ type: 'number' }, { type: 'null' }] });
const stringFields = (names: string[]): Record<string, JsonSchema> =>
  Object.fromEntries(names.map((name) => [name, nullable('string')]));

/** Shallow JSON Schema accepted by Gemini Interactions; canonical validation follows mapping. */
export const geminiTechPackDraftJsonSchema: JsonSchema = {
  type: 'object',

  required: [
    'product',
    'bom',
    'measurements',
    'construction',
    'colorConfiguration',
    'evidence',
  ],

  properties: {
    product: {
      type: 'object',

      required: [
        'description',
        'intendedUse',
      ],

      properties: {
        ...stringFields(['name', 'category']),

        description: { type: 'string' },
        intendedUse: { type: 'string' },

        reversible: {
          anyOf: [
            { type: 'boolean' },
            { type: 'null' },
          ],
        },
      },
    },

    bom: {
      type: 'array',
      minItems: 1,

      items: {
        type: 'object',

        required: [
          'component',
          'material',
        ],

        properties: {
          ...stringFields([
            'id',
            'placement',
            'composition',
            'specification',
            'color',
            'unit',
            'notes',
          ]),

          component: {
            type: 'string',
          },

          material: nullable('string'),

          gsm: {
            anyOf: [
              { type: 'number' },
              { type: 'string' },
              { type: 'null' },
            ],
          },

          gsmApproximate: {
            type: 'boolean',
          },

          quantity: nullableNumberSchema(),
        },
      },
    },

    measurements: {
      type: 'object',

      required: [
        'unit',
        'sizes',
        'points',
      ],

      properties: {
        unit: {
          enum: ['mm', 'cm', 'in'],
        },

        sizes: {
          type: 'array',
          minItems: 3,
          items: nullable('string'),
        },

        points: {
          type: 'array',
          minItems: 1,

          items: {
            type: 'object',

            required: [
              'name',
              'values',
            ],

            properties: {
              ...stringFields([
                'id',
                'instruction',
              ]),

              name: {
                type: 'string',
              },

              values: {
                type: 'array',
                minItems: 3,
                items: nullableNumberSchema(),
              },

              tolerance: nullableNumberSchema(),
            },
          },
        },
      },
    },

    construction: {
      type: 'array',
      minItems: 1,

      items: {
        type: 'object',

        required: [
          'instruction',
        ],

        properties: {
          ...stringFields([
            'id',
            'area',
            'notes',
          ]),

          order: {
            type: 'integer',
          },

          instruction: {
            type: 'string',
          },
        },
      },
    },

    colorConfiguration: {
      type: 'object',

      required: [
        'type',
        'sideA',
        'sideB',
      ],

      properties: {
        type: {
          enum: [
            'reversible',
            'conventional',
          ],
        },

        sideA: nullable('string'),
        sideB: nullable('string'),
      },
    },

    evidence: {
      type: 'array',
      minItems: 1,

      items: {
        type: 'object',

        required: [
          'path',
          'source',
        ],

        properties: {
          path: {
            type: 'string',
          },

          source: {
            enum: [
              'buyer',
              'visual_inference',
              'ai_assumption',
              'not_provided',
            ],
          },

          confirmationRequired: {
            type: 'boolean',
          },

          approximate: {
            type: 'boolean',
          },

          ...stringFields([
            'detail',
            'question',
          ]),
        },
      },
    },
  },
};
