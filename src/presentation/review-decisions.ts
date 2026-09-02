import type { ClaimPrecision, TechPackContent, UnresolvedItem } from '../domain/tech-pack';
import { collectClaimLocations } from '../domain/tech-pack/claim-locations';

export type ReviewDecisionAction =
  | 'add_specification'
  | 'confirm_proposed_values'
  | 'add_and_confirm';

export interface ReviewDecision {
  id: string;
  title: string;
  priority: number;
  whyItMatters: string;
  items: UnresolvedItem[];
  proposedItems: UnresolvedItem[];
  unknownItems: UnresolvedItem[];
  buyerProvidedItems: ReviewKnownItem[];
  action: ReviewDecisionAction;
}

export interface ReviewKnownItem {
  id: string;
  canonicalPath: string;
  fieldLabel: string;
  currentValue: unknown;
  precision: ClaimPrecision;
  unit: string | null;
}

interface DecisionDefinition {
  id: string;
  title: string;
  priority: number;
  whyItMatters: string;
}

const decisionDefinitions = {
  size_specification: {
    id: 'size_specification',
    title: 'Size specification',
    priority: 1,
    whyItMatters: 'Size points, proposed values, and tolerances define the fit that the factory will make.',
  },
  fabric_specification: {
    id: 'fabric_specification',
    title: 'Fabric specification',
    priority: 2,
    whyItMatters: 'Fiber composition and finishing details are needed before fabric can be approved or sourced.',
  },
  thread_specification: {
    id: 'thread_specification',
    title: 'Thread specification',
    priority: 2,
    whyItMatters: 'Thread choice affects stitch appearance, durability, and reversible-side matching.',
  },
  construction_details: {
    id: 'construction_details',
    title: 'Construction details',
    priority: 3,
    whyItMatters: 'Seam allowance, finishing, and visible construction choices must be clear to the factory.',
  },
  material_consumption: {
    id: 'material_consumption',
    title: 'Material consumption',
    priority: 4,
    whyItMatters: 'Consumption and units are required for costing and production planning.',
  },
  labeling: {
    id: 'labeling',
    title: 'Labeling',
    priority: 5,
    whyItMatters: 'Labels need an explicit production decision, placement, and specification.',
  },
  product_details: {
    id: 'product_details',
    title: 'Product details',
    priority: 6,
    whyItMatters: 'This visible product detail should be checked before production instructions are finalized.',
  },
} as const satisfies Record<string, DecisionDefinition>;

type DecisionKey = keyof typeof decisionDefinitions;

function bomItemId(path: string): string | null {
  const match = path.match(/^billOfMaterials\.items\[([^\]]+)\]/);
  return match?.[1] ?? null;
}

function decisionKeyFor(item: Pick<UnresolvedItem, 'canonicalPath' | 'fieldLabel'>): DecisionKey {
  if (item.canonicalPath.startsWith('measurements.')) return 'size_specification';
  if (
    item.canonicalPath.startsWith('construction.') ||
    item.canonicalPath.startsWith('product.notes[')
  ) return 'construction_details';

  const itemId = bomItemId(item.canonicalPath);
  if (itemId !== null) {
    const context = `${itemId} ${item.fieldLabel}`.toLocaleLowerCase('en');
    if (context.includes('label')) return 'labeling';
    if (context.includes('thread')) return 'thread_specification';
    if (item.canonicalPath.endsWith('.quantity')) return 'material_consumption';
    return 'fabric_specification';
  }

  return 'product_details';
}

/**
 * Derives buyer-supplied values for the same decision groups without storing
 * review-only state. These values remain canonical claims and are display-only.
 */
export function selectBuyerProvidedReviewItems(content: TechPackContent): ReviewKnownItem[] {
  return collectClaimLocations(content)
    .filter(({ claim }) => claim.source === 'buyer' && claim.value !== null)
    .map(({ canonicalPath, fieldLabel, unit, claim }) => ({
      id: `buyer-provided:${canonicalPath}`,
      canonicalPath,
      fieldLabel,
      currentValue: claim.value,
      precision: claim.precision,
      unit,
    }));
}

function actionFor(
  proposedItems: UnresolvedItem[],
  unknownItems: UnresolvedItem[],
): ReviewDecisionAction {
  if (unknownItems.length === 0) return 'confirm_proposed_values';
  if (proposedItems.length === 0) return 'add_specification';
  return 'add_and_confirm';
}

/**
 * Converts canonical unresolved claims into prioritized buyer decisions. Every
 * input claim appears exactly once in the result; no review state is stored.
 */
export function groupUnresolvedForReview(
  items: UnresolvedItem[],
  buyerProvidedItems: ReviewKnownItem[] = [],
): ReviewDecision[] {
  const grouped = new Map<DecisionKey, UnresolvedItem[]>();
  for (const item of items) {
    const key = decisionKeyFor(item);
    const current = grouped.get(key) ?? [];
    current.push(item);
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .map(([key, groupedItems]) => {
      const definition = decisionDefinitions[key];
      const proposedItems = groupedItems.filter((item) => item.valueState === 'proposed');
      const unknownItems = groupedItems.filter((item) => item.valueState === 'unknown');
      const decisionBuyerProvidedItems = buyerProvidedItems.filter(
        (item) => decisionKeyFor(item) === key,
      );
      return {
        ...definition,
        items: groupedItems,
        proposedItems,
        unknownItems,
        buyerProvidedItems: decisionBuyerProvidedItems,
        action: actionFor(proposedItems, unknownItems),
      };
    })
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
}
