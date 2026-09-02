import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { bucketHatContentFixture } from '../src/demo/bucket-hat';
import { selectUnresolvedItems } from '../src/domain/tech-pack';
import {
  ReviewDecisionCard,
  readableReviewValue,
  specificationInputKind,
} from '../src/components/review-decision-card';
import {
  groupUnresolvedForReview,
  selectBuyerProvidedReviewItems,
} from '../src/presentation/review-decisions';

function sizeDecision() {
  const decision = groupUnresolvedForReview(
    selectUnresolvedItems(bucketHatContentFixture),
    selectBuyerProvidedReviewItems(bucketHatContentFixture),
  ).find((candidate) => candidate.id === 'size_specification');
  if (decision === undefined) throw new Error('Expected size decision');
  return decision;
}

function visibleText(markup: string): string {
  return markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function renderCard(isEditing: boolean): string {
  return renderToStaticMarkup(createElement(ReviewDecisionCard, {
    decision: sizeDecision(),
    index: 0,
    isEditing,
    onStartEditing: vi.fn(),
    onCancelEditing: vi.fn(),
    onSaveSpecifications: vi.fn(),
    onConfirmProposedValues: vi.fn(),
  }));
}

describe('review specification interaction presentation', () => {
  it('enables Add specification when unknowns exist and blocks mixed confirmation', () => {
    const markup = renderCard(false);

    expect(markup).toContain('>Add specification</button>');
    expect(markup).toContain('disabled="">Confirm proposed values</button>');
    expect(visibleText(markup)).toContain('BUYER PROVIDED');
    expect(visibleText(markup)).toContain('PROPOSED');
    expect(visibleText(markup)).toContain('STILL UNRESOLVED');
  });

  it('opens a readable editor without a redundant action or visible canonical IDs', () => {
    const markup = renderCard(true);
    const text = visibleText(markup);

    expect(text).toContain('ADD SPECIFICATIONS');
    expect(text).toContain('Fill only what you know. Unfilled fields stay unresolved.');
    expect(text).toContain('Head opening circumference — Tolerance');
    expect(text).toContain('Save specifications');
    expect(text).toContain('Cancel');
    expect(markup).not.toContain('>Add specification</button>');
    expect(text).not.toMatch(/pom-|bom-|size-[sml]/i);
  });

  it('supports canonical string, number, boolean, and quantity inputs', () => {
    expect(specificationInputKind('product.description')).toBe('text');
    expect(specificationInputKind('product.reversible')).toBe('boolean');
    expect(specificationInputKind('measurements.points[pom].tolerance')).toBe('number');
    expect(specificationInputKind('billOfMaterials.items[item].quantity')).toBe('quantity');
    expect(readableReviewValue({ amount: 0.45, unit: 'm' })).toBe('0.45 m');
    expect(readableReviewValue(280, 'approximate', 'GSM')).toBe('~280 GSM');
  });
});
