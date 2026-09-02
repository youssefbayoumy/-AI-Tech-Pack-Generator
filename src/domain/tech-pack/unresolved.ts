import { collectClaimLocations, type TechPackSection } from './claim-locations';
import type { ClaimSource, TechPackContent } from './schema';

export interface UnresolvedItem {
  id: string;
  canonicalPath: string;
  section: TechPackSection;
  fieldLabel: string;
  currentValue: unknown;
  unit: string | null;
  valueState: 'unknown' | 'proposed';
  reason: string;
  confirmationQuestion: string;
  source: ClaimSource;
}

function unresolvedReason(source: ClaimSource): string {
  switch (source) {
    case 'not_provided':
      return 'The supplied evidence did not provide a value.';
    case 'ai_assumption':
      return 'This is an AI-proposed draft value, not a confirmed specification.';
    case 'visual_inference':
      return 'This was inferred from visible evidence and is not buyer-confirmed.';
    case 'buyer':
      return 'The buyer must confirm this value.';
    case 'derived':
      return 'This derived value depends on unresolved source fields.';
  }
}

export function selectUnresolvedItems(content: TechPackContent): UnresolvedItem[] {
  return collectClaimLocations(content)
    .filter(({ claim }) => claim.confirmationStatus === 'needs_confirmation')
    .map(({ canonicalPath, section, fieldLabel, unit, claim }) => ({
      id: `unresolved:${canonicalPath}`,
      canonicalPath,
      section,
      fieldLabel,
      currentValue: claim.value,
      unit,
      valueState: claim.value === null ? 'unknown' : 'proposed',
      reason: unresolvedReason(claim.source),
      confirmationQuestion:
        claim.confirmationQuestion ?? 'Confirm or replace this unresolved value.',
      source: claim.source,
    }));
}
