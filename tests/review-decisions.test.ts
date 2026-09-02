import { describe, expect, it } from 'vitest';

import { bucketHatContentFixture } from '../src/demo/bucket-hat';
import { selectUnresolvedItems } from '../src/domain/tech-pack';
import { confirmClaimAtPath } from '../src/app/state/review-actions';
import { groupUnresolvedForReview } from '../src/presentation/review-decisions';

function decisionById(id: string) {
  const decision = groupUnresolvedForReview(selectUnresolvedItems(bucketHatContentFixture)).find(
    (candidate) => candidate.id === id,
  );
  if (decision === undefined) throw new Error(`Expected ${id} review decision`);
  return decision;
}

describe('review-decision presentation adapter', () => {
  it('groups the fixture into six meaningful buyer decisions', () => {
    const decisions = groupUnresolvedForReview(selectUnresolvedItems(bucketHatContentFixture));

    expect(decisions.map((decision) => decision.id)).toEqual([
      'size_specification',
      'fabric_specification',
      'thread_specification',
      'construction_details',
      'material_consumption',
      'labeling',
    ]);
    expect(decisionById('size_specification').items).toHaveLength(24);
  });

  it('keeps every canonical unresolved claim in exactly one decision', () => {
    const unresolved = selectUnresolvedItems(bucketHatContentFixture);
    const groupedPaths = groupUnresolvedForReview(unresolved).flatMap((decision) =>
      decision.items.map((item) => item.canonicalPath),
    );

    expect(new Set(groupedPaths)).toEqual(new Set(unresolved.map((item) => item.canonicalPath)));
    expect(groupedPaths).toHaveLength(unresolved.length);
  });

  it('derives distinct unknown and proposed review actions', () => {
    const unresolved = selectUnresolvedItems(bucketHatContentFixture);
    const proposedOnly = groupUnresolvedForReview(
      unresolved.filter((item) => item.valueState === 'proposed'),
    );
    const unknownOnly = groupUnresolvedForReview(
      unresolved.filter((item) => item.valueState === 'unknown'),
    );

    expect(proposedOnly.find((decision) => decision.id === 'size_specification')?.action).toBe(
      'confirm_proposed_values',
    );
    expect(unknownOnly.find((decision) => decision.id === 'material_consumption')?.action).toBe(
      'add_specification',
    );
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
    expect(after.flatMap((decision) => decision.items)).toHaveLength(50);
  });
});
