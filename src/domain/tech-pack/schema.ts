import { z } from 'zod';

export const TECH_PACK_SCHEMA_VERSION = '1.0.0' as const;

const stableIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/, 'Use a stable lowercase ID');

export const claimSourceSchema = z.enum([
  'buyer',
  'visual_inference',
  'ai_assumption',
  'derived',
  'not_provided',
]);

export const confirmationStatusSchema = z.enum([
  'confirmed_by_buyer',
  'needs_confirmation',
  'not_applicable',
]);

export const claimPrecisionSchema = z.enum(['exact', 'approximate', 'unknown']);

const claimReviewSchema = z.strictObject({
  action: z.enum(['buyer_confirmed', 'buyer_edited']),
  previousSource: claimSourceSchema,
  previousSourceDetail: z.string().min(1).max(500),
});

const claimMetadataShape = {
  precision: claimPrecisionSchema,
  source: claimSourceSchema,
  sourceDetail: z.string().min(1).max(500),
  evidenceRefs: z.array(stableIdSchema).max(20),
  derivedFrom: z.array(z.string().min(1).max(240)).max(20),
  confirmationStatus: confirmationStatusSchema,
  confirmationQuestion: z.string().min(1).max(500).nullable(),
  rationale: z.string().min(1).max(500).nullable(),
  review: claimReviewSchema.nullable(),
} satisfies z.ZodRawShape;

export function claimSchema<T extends z.ZodType>(valueSchema: T) {
  return z.strictObject({
    ...claimMetadataShape,
    value: valueSchema.nullable(),
  });
}

export const stringClaimSchema = claimSchema(z.string().min(1).max(2_000));
export const booleanClaimSchema = claimSchema(z.boolean());
export const numberClaimSchema = claimSchema(z.number().finite());

const quantityValueSchema = z.strictObject({
  amount: z.number().finite().positive(),
  unit: z.string().min(1).max(40),
});

export const quantityClaimSchema = claimSchema(quantityValueSchema);

const productNoteSchema = z.strictObject({
  id: stableIdSchema,
  text: stringClaimSchema,
});

export const productSchema = z.strictObject({
  name: stringClaimSchema,
  category: stringClaimSchema,
  description: stringClaimSchema,
  intendedUse: stringClaimSchema,
  targetUserContext: stringClaimSchema,
  reversible: booleanClaimSchema,
  notes: z.array(productNoteSchema).max(20),
});

export const bomItemSchema = z.strictObject({
  id: stableIdSchema,
  component: stringClaimSchema,
  placement: stringClaimSchema,
  material: stringClaimSchema,
  composition: stringClaimSchema,
  specification: stringClaimSchema,
  weightGsm: numberClaimSchema,
  color: stringClaimSchema,
  quantity: quantityClaimSchema,
  notes: stringClaimSchema,
  reversibleSideId: stableIdSchema.nullable(),
});

export const billOfMaterialsSchema = z.strictObject({
  items: z.array(bomItemSchema).max(100),
});

export const sizeDefinitionSchema = z.strictObject({
  id: stableIdSchema,
  label: stringClaimSchema,
});

export const measurementCellSchema = z.strictObject({
  sizeId: stableIdSchema,
  measurement: numberClaimSchema,
});

export const measurementPointSchema = z.strictObject({
  id: stableIdSchema,
  pointOfMeasure: stringClaimSchema,
  measurementInstruction: stringClaimSchema,
  tolerance: numberClaimSchema,
  values: z.array(measurementCellSchema).max(50),
});

export const measurementSpecificationSchema = z.strictObject({
  unit: z.enum(['mm', 'cm', 'in']),
  sizes: z.array(sizeDefinitionSchema).max(20),
  points: z.array(measurementPointSchema).max(100),
});

export const constructionInstructionSchema = z.strictObject({
  id: stableIdSchema,
  sequence: z.number().int().positive(),
  componentArea: z.string().min(1).max(120),
  instruction: stringClaimSchema,
  notes: stringClaimSchema,
});

export const constructionSchema = z.strictObject({
  instructions: z.array(constructionInstructionSchema).max(100),
});

export const reversibleSideSchema = z.strictObject({
  id: stableIdSchema,
  label: z.string().min(1).max(80),
  color: stringClaimSchema,
});

export const colorComponentSchema = z.strictObject({
  id: stableIdSchema,
  component: z.string().min(1).max(120),
  color: stringClaimSchema,
});

export const conventionalColorwaySchema = z.strictObject({
  id: stableIdSchema,
  name: stringClaimSchema,
  components: z.array(colorComponentSchema).min(1).max(50),
});

export const colorConfigurationSchema = z.strictObject({
  reversibleSides: z.array(reversibleSideSchema).max(2),
  colorways: z.array(conventionalColorwaySchema).max(30),
});

export const techPackContentSchema = z.strictObject({
  product: productSchema,
  billOfMaterials: billOfMaterialsSchema,
  measurements: measurementSpecificationSchema,
  construction: constructionSchema,
  colorConfiguration: colorConfigurationSchema,
});

export const techPackMetadataSchema = z.strictObject({
  schemaVersion: z.literal(TECH_PACK_SCHEMA_VERSION),
  promptVersion: z.string().min(1).max(80),
  generatedAt: z.string().datetime({ offset: true }),
  documentId: stableIdSchema,
  imageFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  lifecycleStatus: z.literal('draft_not_approved_for_production'),
});

export const techPackDocumentSchema = z.strictObject({
  metadata: techPackMetadataSchema,
  content: techPackContentSchema,
});

export const generationInputSchema = z.strictObject({
  buyerDescription: z.string().min(1).max(5_000),
  image: z.strictObject({
    evidenceId: stableIdSchema,
    filename: z.string().min(1).max(255),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    byteSize: z.number().int().positive(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
  }),
  evidence: z
    .array(
      z.strictObject({
        id: stableIdSchema,
        kind: z.enum(['buyer_text', 'reference_image_text', 'reference_image_visual']),
        text: z.string().min(1).max(5_000),
      }),
    )
    .max(20),
});

export type ClaimSource = z.infer<typeof claimSourceSchema>;
export type ClaimPrecision = z.infer<typeof claimPrecisionSchema>;
export type ConfirmationStatus = z.infer<typeof confirmationStatusSchema>;
type GenericClaim = z.infer<ReturnType<typeof claimSchema<z.ZodUnknown>>>;
export type Claim<T> = Omit<GenericClaim, 'value'> & {
  value: T | null;
};
export type TechPackContent = z.infer<typeof techPackContentSchema>;
export type TechPackDocument = z.infer<typeof techPackDocumentSchema>;
export type TechPackMetadata = z.infer<typeof techPackMetadataSchema>;
export type GenerationInput = z.infer<typeof generationInputSchema>;
