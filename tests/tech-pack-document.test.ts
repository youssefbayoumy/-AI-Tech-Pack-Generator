import { describe, expect, it } from 'vitest';

import {
  bomDetailDisplay,
  buyerContextDisplay,
  constructionInstructionDisplay,
  constructionSecondaryDisplay,
  displayClaim,
} from '../src/components/tech-pack-document';
import { bucketHatContentFixture } from '../src/demo/bucket-hat';

describe('technical document presentation', () => {
  it('does not render a secondary unknown below a valid construction instruction', () => {
    const instruction = bucketHatContentFixture.construction.instructions[0]!;

    expect(displayClaim(instruction.instruction)).toBe('Apply a single row of brim topstitching.');
    expect(constructionSecondaryDisplay(instruction.notes)).toBeNull();
  });

  it('turns a missing primary construction value into a specific review request', () => {
    const instruction = bucketHatContentFixture.construction.instructions[1]!;

    expect(constructionInstructionDisplay(instruction.instruction)).toBe(
      'Specify the seam allowance for each seam.',
    );
  });

  it('keeps approximate buyer GSM visibly approximate', () => {
    const item = bucketHatContentFixture.billOfMaterials.items[0]!;
    const gsm = item.weightGsm;

    expect(displayClaim(gsm)).toBe('~280');
    expect(bomDetailDisplay(item.specification, true)).toBe('Cotton twill');
  });

  it('combines existing buyer business context with first-run context once', () => {
    expect(buyerContextDisplay(
      bucketHatContentFixture.product.targetUserContext,
      bucketHatContentFixture.product.intendedUse,
    )).toBe('Small Egyptian apparel brand · First production run');
  });
});
