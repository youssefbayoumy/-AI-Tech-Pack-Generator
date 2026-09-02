import { z } from 'zod';

import { collectClaimLocations } from './claim-locations';
import { techPackContentSchema, type TechPackContent } from './schema';

export const validationErrorSchema = z.strictObject({
  code: z.string().min(1),
  path: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['error', 'warning']),
});

export type ValidationError = z.infer<typeof validationErrorSchema>;

export type ValidationResult =
  | { success: true; data: TechPackContent; errors: [] }
  | { success: false; data: null; errors: ValidationError[] };

export interface ValidationOptions {
  phase?: 'generation' | 'review';
}

function error(code: string, path: string, message: string): ValidationError {
  return { code, path, message, severity: 'error' };
}

function zodPath(path: PropertyKey[]): string {
  if (path.length === 0) return '$';
  return path
    .map((segment, index) => {
      if (typeof segment === 'number') return `[${segment}]`;
      const value = String(segment);
      return index === 0 ? value : `.${value}`;
    })
    .join('');
}

function mapZodIssue(issue: z.ZodIssue): ValidationError {
  const domainCode =
    issue.code === 'custom' && typeof issue.params?.domainCode === 'string'
      ? issue.params.domainCode
      : 'SCHEMA_INVALID';
  return error(domainCode, zodPath(issue.path), issue.message);
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('en');
}

function duplicateValues(values: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

function addDuplicateIdErrors(
  errors: ValidationError[],
  ids: string[],
  collectionPath: string,
  code: string,
): void {
  for (const duplicate of duplicateValues(ids)) {
    errors.push(error(code, collectionPath, `Duplicate stable ID: ${duplicate}`));
  }
}

function validateClaims(content: TechPackContent, errors: ValidationError[]): void {
  for (const locatedClaim of collectClaimLocations(content)) {
    const { claim, canonicalPath } = locatedClaim;

    if (claim.value === null && claim.precision !== 'unknown') {
      errors.push(
        error(
          'CLAIM_NULL_MUST_BE_UNKNOWN',
          `${canonicalPath}.precision`,
          'A null claim must use unknown precision',
        ),
      );
    }
    if (claim.value !== null && claim.precision === 'unknown') {
      errors.push(
        error(
          'CLAIM_VALUE_CANNOT_BE_UNKNOWN',
          `${canonicalPath}.precision`,
          'A non-null claim cannot use unknown precision',
        ),
      );
    }

    const needsConfirmation = claim.confirmationStatus === 'needs_confirmation';
    if (needsConfirmation !== (claim.confirmationQuestion !== null)) {
      errors.push(
        error(
          'CLAIM_CONFIRMATION_QUESTION_MISMATCH',
          `${canonicalPath}.confirmationQuestion`,
          'A confirmation question is required only when confirmation is needed',
        ),
      );
    }

    if (claim.source === 'buyer') {
      if (claim.value === null || claim.confirmationStatus !== 'confirmed_by_buyer') {
        errors.push(
          error(
            'BUYER_CLAIM_MUST_BE_CONFIRMED',
            `${canonicalPath}.confirmationStatus`,
            'Buyer-provided claims must be non-null and buyer-confirmed',
          ),
        );
      }
      if (claim.evidenceRefs.length === 0 && claim.review === null) {
        errors.push(
          error(
            'BUYER_CLAIM_REQUIRES_EVIDENCE',
            `${canonicalPath}.evidenceRefs`,
            'Initial buyer claims require at least one evidence reference',
          ),
        );
      }
    }

    if (claim.source === 'visual_inference' || claim.source === 'ai_assumption') {
      if (claim.value === null || claim.confirmationStatus !== 'needs_confirmation') {
        errors.push(
          error(
            'UNCONFIRMED_SOURCE_STATUS_INVALID',
            `${canonicalPath}.confirmationStatus`,
            'Visual inferences and AI assumptions must be non-null and require confirmation',
          ),
        );
      }
    }

    if (claim.source === 'visual_inference' && claim.evidenceRefs.length === 0) {
      errors.push(
        error(
          'VISUAL_INFERENCE_REQUIRES_EVIDENCE',
          `${canonicalPath}.evidenceRefs`,
          'Visual inferences require an image evidence reference',
        ),
      );
    }

    if (claim.source === 'derived') {
      if (
        claim.confirmationStatus !== 'not_applicable' ||
        claim.derivedFrom.length === 0
      ) {
        errors.push(
          error(
            'DERIVED_CLAIM_INVALID',
            `${canonicalPath}.derivedFrom`,
            'Derived claims must not require confirmation and must reference source fields',
          ),
        );
      }
    } else if (claim.derivedFrom.length > 0) {
      errors.push(
        error(
          'NON_DERIVED_CLAIM_HAS_DEPENDENCIES',
          `${canonicalPath}.derivedFrom`,
          'Only derived claims may contain derivedFrom references',
        ),
      );
    }

    if (
      claim.source === 'not_provided' &&
      (claim.value !== null ||
        claim.precision !== 'unknown' ||
        claim.confirmationStatus !== 'needs_confirmation')
    ) {
      errors.push(
        error(
          'NOT_PROVIDED_CLAIM_INVALID',
          `${canonicalPath}.source`,
          'Not-provided claims must be null, unknown, and require confirmation',
        ),
      );
    }

    if (
      claim.review !== null &&
      (claim.source !== 'buyer' || claim.confirmationStatus !== 'confirmed_by_buyer')
    ) {
      errors.push(
        error(
          'CLAIM_REVIEW_TRANSITION_INVALID',
          `${canonicalPath}.review`,
          'A reviewed claim must be buyer-sourced and buyer-confirmed',
        ),
      );
    }
  }
}

function validateGeneral(content: TechPackContent, errors: ValidationError[]): void {
  if (content.product.description.value === null) {
    errors.push(
      error('PRODUCT_DESCRIPTION_REQUIRED', 'product.description', 'Product description is required'),
    );
  }
  if (content.product.intendedUse.value === null) {
    errors.push(error('INTENDED_USE_REQUIRED', 'product.intendedUse', 'Intended use is required'));
  }
  if (content.billOfMaterials.items.length === 0) {
    errors.push(error('BOM_REQUIRED', 'billOfMaterials.items', 'At least one BOM item is required'));
  }
  if (content.measurements.points.length === 0) {
    errors.push(
      error('MEASUREMENT_SPEC_REQUIRED', 'measurements.points', 'At least one POM is required'),
    );
  }
  if (content.construction.instructions.length === 0) {
    errors.push(
      error(
        'CONSTRUCTION_REQUIRED',
        'construction.instructions',
        'At least one construction instruction is required',
      ),
    );
  }
  if (
    content.colorConfiguration.reversibleSides.length === 0 &&
    content.colorConfiguration.colorways.length === 0
  ) {
    errors.push(
      error(
        'COLOR_CONFIGURATION_REQUIRED',
        'colorConfiguration',
        'Reversible sides or at least one conventional colorway is required',
      ),
    );
  }
}

function validateBom(content: TechPackContent, errors: ValidationError[]): void {
  const items = content.billOfMaterials.items;
  addDuplicateIdErrors(errors, items.map((item) => item.id), 'billOfMaterials.items', 'BOM_ID_DUPLICATE');

  if (items.length > 0 && !items.some((item) => item.material.value !== null)) {
    errors.push(
      error(
        'BOM_MATERIAL_REQUIRED',
        'billOfMaterials.items',
        'At least one BOM item must contain a material value',
      ),
    );
  }
}

function validateMeasurements(content: TechPackContent, errors: ValidationError[]): void {
  const { sizes, points } = content.measurements;
  if (sizes.length < 3) {
    errors.push(
      error('MEASUREMENT_MINIMUM_SIZES', 'measurements.sizes', 'At least three sizes are required'),
    );
  }

  addDuplicateIdErrors(errors, sizes.map((size) => size.id), 'measurements.sizes', 'SIZE_ID_DUPLICATE');
  addDuplicateIdErrors(errors, points.map((point) => point.id), 'measurements.points', 'POM_ID_DUPLICATE');

  const normalizedLabels = sizes
    .map((size) => size.label.value)
    .filter((label): label is string => label !== null)
    .map(normalized);
  for (const duplicate of duplicateValues(normalizedLabels)) {
    errors.push(
      error('SIZE_LABEL_DUPLICATE', 'measurements.sizes', `Duplicate size label: ${duplicate}`),
    );
  }

  const expectedSizeIds = new Set(sizes.map((size) => size.id));
  for (const point of points) {
    const path = `measurements.points[${point.id}].values`;
    const actualIds = point.values.map((cell) => cell.sizeId);
    for (const duplicate of duplicateValues(actualIds)) {
      errors.push(error('MEASUREMENT_SIZE_DUPLICATE', path, `Duplicate size cell: ${duplicate}`));
    }

    const actualIdSet = new Set(actualIds);
    const missing = [...expectedSizeIds].filter((sizeId) => !actualIdSet.has(sizeId));
    const unexpected = [...actualIdSet].filter((sizeId) => !expectedSizeIds.has(sizeId));
    if (missing.length > 0 || unexpected.length > 0) {
      errors.push(
        error(
          'MEASUREMENT_SIZE_KEYS_MISMATCH',
          path,
          `Measurement cells must match size IDs; missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}`,
        ),
      );
    }

    for (const cell of point.values) {
      const claim = cell.measurement;
      if (
        (claim.source === 'ai_assumption' || claim.source === 'visual_inference') &&
        claim.confirmationStatus !== 'needs_confirmation'
      ) {
        errors.push(
          error(
            'MEASUREMENT_ASSUMPTION_MUST_BE_UNCONFIRMED',
            `${path}[${cell.sizeId}].measurement`,
            'An assumed or visually inferred measurement must require confirmation',
          ),
        );
      }
    }

    const tolerance = point.tolerance;
    if (
      (tolerance.source === 'ai_assumption' || tolerance.source === 'visual_inference') &&
      tolerance.confirmationStatus !== 'needs_confirmation'
    ) {
      errors.push(
        error(
          'TOLERANCE_ASSUMPTION_MUST_BE_UNCONFIRMED',
          `measurements.points[${point.id}].tolerance`,
          'An assumed or visually inferred tolerance must require confirmation',
        ),
      );
    }
  }
}

function validateConstruction(content: TechPackContent, errors: ValidationError[]): void {
  const instructions = content.construction.instructions;
  addDuplicateIdErrors(
    errors,
    instructions.map((instruction) => instruction.id),
    'construction.instructions',
    'CONSTRUCTION_ID_DUPLICATE',
  );

  for (const duplicate of duplicateValues(instructions.map((item) => String(item.sequence)))) {
    errors.push(
      error(
        'CONSTRUCTION_SEQUENCE_DUPLICATE',
        'construction.instructions',
        `Duplicate construction sequence: ${duplicate}`,
      ),
    );
  }
}

function validateReversibleConfiguration(
  content: TechPackContent,
  errors: ValidationError[],
): void {
  const reversible = content.product.reversible.value;
  const sides = content.colorConfiguration.reversibleSides;
  const colorways = content.colorConfiguration.colorways;

  addDuplicateIdErrors(
    errors,
    sides.map((side) => side.id),
    'colorConfiguration.reversibleSides',
    'REVERSIBLE_SIDE_ID_DUPLICATE',
  );
  addDuplicateIdErrors(
    errors,
    colorways.map((colorway) => colorway.id),
    'colorConfiguration.colorways',
    'COLORWAY_ID_DUPLICATE',
  );

  if (reversible === true) {
    const sideIds = new Set(sides.map((side) => side.id));
    if (sides.length !== 2 || !sideIds.has('side-a') || !sideIds.has('side-b')) {
      errors.push(
        error(
          'REVERSIBLE_SIDES_INCOMPLETE',
          'colorConfiguration.reversibleSides',
          'A reversible product requires exactly side-a and side-b',
        ),
      );
    }
    if (colorways.length > 0) {
      errors.push(
        error(
          'REVERSIBLE_COLORWAYS_REDUNDANT',
          'colorConfiguration.colorways',
          'Reversible wearing orientations are not separate manufactured colorways',
        ),
      );
    }
  }

  if (reversible === false) {
    if (sides.length > 0 || colorways.length === 0) {
      errors.push(
        error(
          'CONVENTIONAL_COLOR_CONFIGURATION_INVALID',
          'colorConfiguration',
          'A non-reversible product requires conventional colorways and no reversible sides',
        ),
      );
    }
  }

  if (sides.length === 2) {
    const [first, second] = sides;
    if (
      first !== undefined &&
      second !== undefined &&
      first?.color.value !== null &&
      second?.color.value !== null &&
      normalized(first.color.value) === normalized(second.color.value)
    ) {
      errors.push(
        error(
          'REVERSIBLE_SIDE_COLORS_CONTRADICTORY',
          'colorConfiguration.reversibleSides',
          'Reversible sides must not duplicate the same stated color',
        ),
      );
    }
  }

  const sidesById = new Map(sides.map((side) => [side.id, side]));
  for (const item of content.billOfMaterials.items) {
    if (item.reversibleSideId === null) continue;
    const side = sidesById.get(item.reversibleSideId);
    const path = `billOfMaterials.items[${item.id}].reversibleSideId`;
    if (side === undefined) {
      errors.push(
        error(
          'BOM_REVERSIBLE_SIDE_UNKNOWN',
          path,
          `BOM item references unknown reversible side: ${item.reversibleSideId}`,
        ),
      );
      continue;
    }
    if (
      item.color.value !== null &&
      side.color.value !== null &&
      normalized(item.color.value) !== normalized(side.color.value)
    ) {
      errors.push(
        error(
          'BOM_REVERSIBLE_COLOR_CONTRADICTION',
          `billOfMaterials.items[${item.id}].color`,
          `BOM color contradicts ${side.id} color`,
        ),
      );
    }
  }
}

function validateGenerationBoundary(
  content: TechPackContent,
  errors: ValidationError[],
  phase: 'generation' | 'review',
): void {
  if (phase !== 'generation') return;
  for (const locatedClaim of collectClaimLocations(content)) {
    if (locatedClaim.claim.review !== null) {
      errors.push(
        error(
          'MODEL_CONTENT_CANNOT_CONTAIN_REVIEW',
          `${locatedClaim.canonicalPath}.review`,
          'Model-generated content cannot claim a buyer review transition',
        ),
      );
    }
  }
}

export function validateTechPackSemantics(
  content: TechPackContent,
  options: ValidationOptions = {},
): ValidationError[] {
  const errors: ValidationError[] = [];
  validateClaims(content, errors);
  validateGeneral(content, errors);
  validateBom(content, errors);
  validateMeasurements(content, errors);
  validateConstruction(content, errors);
  validateReversibleConfiguration(content, errors);
  validateGenerationBoundary(content, errors, options.phase ?? 'generation');
  return errors;
}

export function validateTechPackContent(
  input: unknown,
  options: ValidationOptions = {},
): ValidationResult {
  const parsed = techPackContentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      data: null,
      errors: parsed.error.issues.map(mapZodIssue),
    };
  }

  const errors = validateTechPackSemantics(parsed.data, options);
  if (errors.length > 0) return { success: false, data: null, errors };
  return { success: true, data: parsed.data, errors: [] };
}
