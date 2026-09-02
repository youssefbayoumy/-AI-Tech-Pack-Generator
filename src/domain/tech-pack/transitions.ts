import type { Claim, ClaimPrecision } from './schema';

function requireDetail(detail: string): string {
  const normalized = detail.trim();
  if (normalized.length === 0) throw new Error('Buyer review detail is required');
  return normalized;
}

export function confirmClaim<T>(claim: Claim<T>, buyerDetail: string): Claim<T> {
  if (claim.value === null) {
    throw new Error('An unknown claim cannot be confirmed without a value');
  }

  return {
    ...claim,
    source: 'buyer',
    sourceDetail: requireDetail(buyerDetail),
    evidenceRefs: [],
    derivedFrom: [],
    confirmationStatus: 'confirmed_by_buyer',
    confirmationQuestion: null,
    review: {
      action: 'buyer_confirmed',
      previousSource: claim.source,
      previousSourceDetail: claim.sourceDetail,
    },
  };
}

export interface EditClaimOptions {
  buyerDetail: string;
  precision?: Exclude<ClaimPrecision, 'unknown'>;
}

export function editClaim<T>(
  claim: Claim<T>,
  nextValue: T,
  options: EditClaimOptions,
): Claim<T> {
  if (nextValue === null || nextValue === undefined) {
    throw new Error('Use an explicit unresolved/clear operation instead of confirming a null value');
  }

  return {
    ...claim,
    value: nextValue,
    precision: options.precision ?? 'exact',
    source: 'buyer',
    sourceDetail: requireDetail(options.buyerDetail),
    evidenceRefs: [],
    derivedFrom: [],
    confirmationStatus: 'confirmed_by_buyer',
    confirmationQuestion: null,
    review: {
      action: 'buyer_edited',
      previousSource: claim.source,
      previousSourceDetail: claim.sourceDetail,
    },
  };
}
