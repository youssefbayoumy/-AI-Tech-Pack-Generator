import { describe, expect, it } from 'vitest';

import {
  confirmClaim,
  editClaim,
  numberClaimSchema,
  selectUnresolvedItems,
  techPackContentSchema,
  techPackDocumentSchema,
  validateTechPackContent,
  type TechPackContent,
} from '../src/domain/tech-pack';
import {
  bucketHatContentFixture,
  bucketHatDocumentFixture,
} from '../src/demo/bucket-hat';
import { collectClaimLocations } from '../src/domain/tech-pack/claim-locations';
import { confirmClaimAtPath } from '../src/app/state/review-actions';

function cloneFixture(): TechPackContent {
  return structuredClone(bucketHatContentFixture);
}

function validationCodes(input: unknown): string[] {
  const result = validateTechPackContent(input);
  return result.success ? [] : result.errors.map((item) => item.code);
}

describe('canonical bucket-hat fixture', () => {
  it('accepts the valid recruiter fixture and server-owned document wrapper', () => {
    expect(validateTechPackContent(bucketHatContentFixture)).toEqual({
      success: true,
      data: bucketHatContentFixture,
      errors: [],
    });
    expect(techPackDocumentSchema.safeParse(bucketHatDocumentFixture).success).toBe(true);
  });

  it('preserves approximate semantics for ~280 GSM', () => {
    const sideA = bucketHatContentFixture.billOfMaterials.items.find(
      (item) => item.id === 'shell-side-a',
    );
    expect(sideA?.weightGsm.value).toBe(280);
    expect(sideA?.weightGsm.precision).toBe('approximate');
    expect(sideA?.weightGsm.source).toBe('buyer');
  });

  it('keeps buyer-provided S/M/L labels separate from assumed numeric measurements', () => {
    expect(bucketHatContentFixture.measurements.sizes.map((size) => size.label.source)).toEqual([
      'buyer',
      'buyer',
      'buyer',
    ]);
    for (const point of bucketHatContentFixture.measurements.points) {
      for (const cell of point.values) {
        expect(cell.measurement.source).toBe('ai_assumption');
        expect(cell.measurement.confirmationStatus).toBe('needs_confirmation');
      }
    }
  });

  it('allows null unknowns and derived non-applicable nulls', () => {
    const thread = bucketHatContentFixture.billOfMaterials.items.find(
      (item) => item.id === 'sewing-thread',
    );
    expect(thread?.material.value).toBeNull();
    expect(thread?.material.source).toBe('not_provided');
    expect(thread?.weightGsm.value).toBeNull();
    expect(thread?.weightGsm.confirmationStatus).toBe('not_applicable');
    expect(validateTechPackContent(bucketHatContentFixture).success).toBe(true);
  });
});
describe('required content', () => {
  it('rejects a missing product description', () => {
    const invalid = cloneFixture();
    invalid.product.description = {
      ...invalid.product.description,
      value: null,
      precision: 'unknown',
      source: 'not_provided',
      evidenceRefs: [],
      confirmationStatus: 'needs_confirmation',
      confirmationQuestion: 'Provide a product description.',
    };
    expect(validationCodes(invalid)).toContain('PRODUCT_DESCRIPTION_REQUIRED');
  });

  it('rejects a missing intended use', () => {
    const invalid = cloneFixture();
    invalid.product.intendedUse = {
      ...invalid.product.intendedUse,
      value: null,
      precision: 'unknown',
      source: 'not_provided',
      evidenceRefs: [],
      confirmationStatus: 'needs_confirmation',
      confirmationQuestion: 'Provide intended use.',
    };
    expect(validationCodes(invalid)).toContain('INTENDED_USE_REQUIRED');
  });

  it('rejects a missing BOM', () => {
    const invalid = cloneFixture();
    invalid.billOfMaterials.items = [];
    expect(validationCodes(invalid)).toContain('BOM_REQUIRED');
  });

  it('rejects missing construction notes', () => {
    const invalid = cloneFixture();
    invalid.construction.instructions = [];
    expect(validationCodes(invalid)).toContain('CONSTRUCTION_REQUIRED');
  });

  it('rejects missing colorway and reversible-side information', () => {
    const invalid = cloneFixture();
    invalid.colorConfiguration.reversibleSides = [];
    invalid.colorConfiguration.colorways = [];
    const codes = validationCodes(invalid);
    expect(codes).toContain('COLOR_CONFIGURATION_REQUIRED');
    expect(codes).toContain('REVERSIBLE_SIDES_INCOMPLETE');
  });
});
describe('measurement rules', () => {
  it('rejects charts with fewer than three sizes', () => {
    const invalid = cloneFixture();
    invalid.measurements.sizes = invalid.measurements.sizes.slice(0, 2);
    for (const point of invalid.measurements.points) point.values = point.values.slice(0, 2);
    expect(validationCodes(invalid)).toContain('MEASUREMENT_MINIMUM_SIZES');
  });

  it('rejects duplicate size labels', () => {
    const invalid = cloneFixture();
    const second = invalid.measurements.sizes[1];
    if (second === undefined) throw new Error('Fixture must have a second size');
    second.label = { ...second.label, value: 'S' };
    expect(validationCodes(invalid)).toContain('SIZE_LABEL_DUPLICATE');
  });

  it('rejects size-cell keys that do not align with size definitions', () => {
    const invalid = cloneFixture();
    const firstPoint = invalid.measurements.points[0];
    if (firstPoint === undefined) throw new Error('Fixture must have a POM');
    firstPoint.values = firstPoint.values.filter((cell) => cell.sizeId !== 'size-l');
    expect(validationCodes(invalid)).toContain('MEASUREMENT_SIZE_KEYS_MISMATCH');
  });

  it('rejects an AI-assumed measurement marked buyer-confirmed', () => {
    const invalid = cloneFixture();
    const claim = invalid.measurements.points[0]?.values[0]?.measurement;
    if (claim === undefined) throw new Error('Fixture must have a measurement');
    claim.confirmationStatus = 'confirmed_by_buyer';
    claim.confirmationQuestion = null;
    expect(validationCodes(invalid)).toContain('UNCONFIRMED_SOURCE_STATUS_INVALID');
  });

  it('rejects a visual-inference measurement marked buyer-confirmed', () => {
    const invalid = cloneFixture();
    const claim = invalid.measurements.points[0]?.values[0]?.measurement;
    if (claim === undefined) throw new Error('Fixture must have a measurement');
    claim.source = 'visual_inference';
    claim.evidenceRefs = ['reference-image-visual'];
    claim.confirmationStatus = 'confirmed_by_buyer';
    claim.confirmationQuestion = null;
    expect(validationCodes(invalid)).toContain('UNCONFIRMED_SOURCE_STATUS_INVALID');
  });
});

describe('stable IDs and reversible configuration', () => {
  it.each([
    ['BOM', 'BOM_ID_DUPLICATE', (content: TechPackContent) => {
      const second = content.billOfMaterials.items[1];
      if (second !== undefined) second.id = content.billOfMaterials.items[0]?.id ?? second.id;
    }],
    ['POM', 'POM_ID_DUPLICATE', (content: TechPackContent) => {
      const second = content.measurements.points[1];
      if (second !== undefined) second.id = content.measurements.points[0]?.id ?? second.id;
    }],
    ['construction', 'CONSTRUCTION_ID_DUPLICATE', (content: TechPackContent) => {
      const second = content.construction.instructions[1];
      if (second !== undefined) {
        second.id = content.construction.instructions[0]?.id ?? second.id;
      }
    }],
  ])('rejects duplicate %s IDs', (_label, expectedCode, mutate) => {
    const invalid = cloneFixture();
    mutate(invalid);
    expect(validationCodes(invalid)).toContain(expectedCode);
  });

  it('validates one physical reversible product with side A and side B', () => {
    expect(bucketHatContentFixture.product.reversible.value).toBe(true);
    expect(bucketHatContentFixture.colorConfiguration.reversibleSides).toHaveLength(2);
    expect(bucketHatContentFixture.colorConfiguration.colorways).toHaveLength(0);
    expect(validateTechPackContent(bucketHatContentFixture).success).toBe(true);
  });

  it('rejects incomplete or contradictory reversible configurations', () => {
    const incomplete = cloneFixture();
    incomplete.colorConfiguration.reversibleSides.pop();
    expect(validationCodes(incomplete)).toContain('REVERSIBLE_SIDES_INCOMPLETE');

    const contradictory = cloneFixture();
    const secondSide = contradictory.colorConfiguration.reversibleSides[1];
    if (secondSide === undefined) throw new Error('Fixture must have side B');
    secondSide.color = { ...secondSide.color, value: 'Khaki' };
    expect(validationCodes(contradictory)).toContain('REVERSIBLE_SIDE_COLORS_CONTRADICTORY');
  });
});

describe('needs-confirmation and review transitions', () => {
  it('derives unresolved items from canonical claims only', () => {
    const unresolved = selectUnresolvedItems(bucketHatContentFixture);
    expect(unresolved.length).toBeGreaterThan(20);
    expect(unresolved.every((item) => item.id.startsWith('unresolved:'))).toBe(true);
    expect(unresolved.some((item) => item.valueState === 'unknown')).toBe(true);
    expect(unresolved.some((item) => item.valueState === 'proposed')).toBe(true);
    expect(
      unresolved.some(
        (item) =>
          item.canonicalPath ===
          'measurements.points[pom-head-opening].values[size-s].measurement',
      ),
    ).toBe(true);
  });

  it('does not include buyer-confirmed claims in unresolved output', () => {
    const unresolvedPaths = new Set(
      selectUnresolvedItems(bucketHatContentFixture).map((item) => item.canonicalPath),
    );
    expect(unresolvedPaths.has('product.description')).toBe(false);
    expect(unresolvedPaths.has('colorConfiguration.reversibleSides[side-a].color')).toBe(false);
  });

  it('keeps the explicit claim-location registry in sync with the fixture', () => {
    // A new claim-bearing fixture field must be deliberately registered; this
    // makes an accidental omission visible in the domain test suite.
    expect(collectClaimLocations(bucketHatContentFixture)).toHaveLength(78);
  });

  it('confirms and edits uncertain claims as buyer-reviewed while preserving origin', () => {
    const proposed = bucketHatContentFixture.measurements.points[0]?.values[0]?.measurement;
    if (proposed === undefined) throw new Error('Fixture must have a proposed measurement');

    const confirmed = confirmClaim(proposed, 'Buyer confirmed during tech-pack review.');
    expect(confirmed.source).toBe('buyer');
    expect(confirmed.confirmationStatus).toBe('confirmed_by_buyer');
    expect(confirmed.review).toMatchObject({
      action: 'buyer_confirmed',
      previousSource: 'ai_assumption',
    });
    expect(numberClaimSchema.safeParse(confirmed).success).toBe(true);

    const edited = editClaim(proposed, 57, {
      buyerDetail: 'Buyer replaced the proposed size-S value.',
      precision: 'exact',
    });
    expect(edited.value).toBe(57);
    expect(edited.review).toMatchObject({
      action: 'buyer_edited',
      previousSource: 'ai_assumption',
    });
    expect(numberClaimSchema.safeParse(edited).success).toBe(true);
  });

  it('adapts a registry-emitted path into the shared canonical review state', () => {
    const content = cloneFixture();
    const path = 'measurements.points[pom-head-opening].values[size-s].measurement';
    const next = confirmClaimAtPath(content, path);

    expect(next.measurements.points[0]?.values[0]?.measurement.confirmationStatus).toBe(
      'confirmed_by_buyer',
    );
    expect(selectUnresolvedItems(next).some((item) => item.canonicalPath === path)).toBe(false);
    expect(validateTechPackContent(next, { phase: 'review' }).success).toBe(true);
  });

  it('rejects model-generated content that fabricates a buyer-review transition', () => {
    const invalid = cloneFixture();
    const claim = invalid.measurements.points[0]?.values[0]?.measurement;
    if (claim === undefined) throw new Error('Fixture must have a measurement');
    const reviewed = confirmClaim(claim, 'Fabricated model review.');
    invalid.measurements.points[0]!.values[0]!.measurement = reviewed;

    expect(validationCodes(invalid)).toContain('MODEL_CONTENT_CANNOT_CONTAIN_REVIEW');
    expect(validateTechPackContent(invalid, { phase: 'review' }).success).toBe(true);
  });
});

describe('model/server trust boundary', () => {
  it('does not allow system metadata inside model-controlled TechPackContent', () => {
    const maliciousModelOutput = {
      ...bucketHatContentFixture,
      metadata: bucketHatDocumentFixture.metadata,
    };
    expect(techPackContentSchema.safeParse(maliciousModelOutput).success).toBe(false);
  });
});
