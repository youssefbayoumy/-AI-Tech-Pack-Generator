import { describe, expect, it } from 'vitest';

import { bucketHatContentFixture } from '../src/demo/bucket-hat';
import { selectUnresolvedItems } from '../src/domain/tech-pack';
import { applyBuyerSpecificationAtPath, confirmClaimAtPath } from '../src/app/state/review-actions';
import { collectClaimLocations } from '../src/domain/tech-pack/claim-locations';
import {
  groupUnresolvedForReview,
  selectBuyerProvidedReviewItems,
} from '../src/presentation/review-decisions';

function decisionById(id: string) {
  const decision = groupUnresolvedForReview(selectUnresolvedItems(bucketHatContentFixture)).find(
    (candidate) => candidate.id === id,
  );
  if (decision === undefined) throw new Error(`Expected ${id} review decision`);
  return decision;
}

describe('review-decision presentation adapter', () => {
  it('groups only proposed claims into meaningful buyer decisions', () => {
    const decisions = groupUnresolvedForReview(selectUnresolvedItems(bucketHatContentFixture));

    expect(decisions.map((decision) => decision.id)).toEqual([
      'size_specification',
      'thread_specification',
      'construction_details',
      'labeling',
    ]);
    expect(decisionById('size_specification').items).toHaveLength(20);
  });

  it('keeps every canonical unresolved claim in exactly one decision', () => {
    const unresolved = selectUnresolvedItems(bucketHatContentFixture);
    const groupedPaths = groupUnresolvedForReview(unresolved).flatMap((decision) =>
      decision.items.map((item) => item.canonicalPath),
    );

    expect(new Set(groupedPaths)).toEqual(new Set(unresolved.map((item) => item.canonicalPath)));
    expect(groupedPaths).toHaveLength(unresolved.length);
  });

  it('uses immediate proposal acceptance without an add-specification action', () => {
    const unresolved = selectUnresolvedItems(bucketHatContentFixture);
    const proposedOnly = groupUnresolvedForReview(
      unresolved.filter((item) => item.valueState === 'proposed'),
    );

    expect(proposedOnly.find((decision) => decision.id === 'size_specification')?.action).toBe(
      'confirm_proposed_values',
    );
  });

  it('keeps buyer-provided size labels separate from proposed numeric measurements', () => {
    const decision = groupUnresolvedForReview(
      selectUnresolvedItems(bucketHatContentFixture),
      selectBuyerProvidedReviewItems(bucketHatContentFixture),
    ).find((candidate) => candidate.id === 'size_specification');

    expect(decision?.buyerProvidedItems.map((item) => item.currentValue)).toEqual(['S', 'M', 'L']);
    expect(decision?.proposedItems.every((item) => item.source === 'ai_assumption')).toBe(true);
  });

  it('orders decisions deterministically by explicit manufacturing priority', () => {
    const unresolved = selectUnresolvedItems(bucketHatContentFixture);
    const forward = groupUnresolvedForReview(unresolved).map((decision) => decision.id);
    const reverse = groupUnresolvedForReview([...unresolved].reverse()).map((decision) => decision.id);

    expect(reverse).toEqual(forward);
  });

  it('recalculates decision field counts after a canonical confirmation', () => {
    const before = groupUnresolvedForReview(selectUnresolvedItems(bucketHatContentFixture));
    const confirmed = confirmClaimAtPath(
      structuredClone(bucketHatContentFixture),
      'measurements.points[pom-head-opening].values[size-s].measurement',
    );
    const after = groupUnresolvedForReview(selectUnresolvedItems(confirmed));

      expect(after.find((decision) => decision.id === 'size_specification')?.items).toHaveLength(
      (before.find((decision) => decision.id === 'size_specification')?.items.length ?? 0) - 1,
    );
    expect(after.flatMap((decision) => decision.items)).toHaveLength(
      before.flatMap((decision) => decision.items).length - 1,
    );
  });

  it('uses contextual presentation labels without exposing canonical IDs', () => {
    const labels = collectClaimLocations(bucketHatContentFixture).map((item) => item.fieldLabel);

    expect(labels).toContain('Shell / Side A — Color');
    expect(labels).toContain('Crown height — Tolerance');
    expect(labels).toContain('Size label — S');
    expect(labels.some((label) => /bom-|pom-|size-[sml]/i.test(label))).toBe(false);
  });

  it('edits one proposed value through the canonical edit transition only', () => {
    const path = 'measurements.points[pom-head-opening].values[size-s].measurement';
    const before = groupUnresolvedForReview(selectUnresolvedItems(bucketHatContentFixture));
    const content = applyBuyerSpecificationAtPath(structuredClone(bucketHatContentFixture), path, 57);
    const after = groupUnresolvedForReview(selectUnresolvedItems(content));
    const edited = content.measurements.points.find((point) => point.id === 'pom-head-opening')!.values[0]!.measurement;

    expect(edited).toMatchObject({
      value: 57,
      source: 'buyer',
      confirmationStatus: 'confirmed_by_buyer',
      review: { action: 'buyer_edited', previousSource: 'ai_assumption' },
    });
    expect(after.find((decision) => decision.id === 'size_specification')!.items).toHaveLength(
      before.find((decision) => decision.id === 'size_specification')!.items.length - 1,
    );
    expect(after.find((decision) => decision.id === 'size_specification')!.unknownItems).toHaveLength(0);
    expect(content.measurements.points[0]!.values[1]!.measurement.source).toBe('ai_assumption');
  });
});
