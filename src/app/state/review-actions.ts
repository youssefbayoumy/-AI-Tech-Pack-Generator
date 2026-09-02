import { confirmClaim, editClaim, type Claim, type TechPackContent } from '../../domain/tech-pack';

export type BuyerSpecificationValue = string | number | boolean | { amount: number; unit: string };

function findById<T extends { id: string }>(items: readonly T[], id: string, path: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`No canonical claim exists at ${path}`);
  return item;
}

function capture(match: RegExpMatchArray, index: number, path: string): string {
  const value = match[index];
  if (value === undefined) throw new Error(`Invalid canonical path: ${path}`);
  return value;
}

function confirmationDetail(path: string): string {
  return `Buyer confirmed ${path} during the prototype review.`;
}

function specificationDetail(path: string): string {
  return `Buyer supplied ${path} during the prototype review.`;
}

type ClaimTransition = (claim: Claim<unknown>, path: string) => Claim<unknown>;

function transitionClaimAtPath(
  content: TechPackContent,
  path: string,
  transition: ClaimTransition,
): TechPackContent {
  const next = structuredClone(content);
  const apply = <T>(claim: Claim<T>): Claim<T> => transition(claim, path) as Claim<T>;

  switch (path) {
    case 'product.name':
      next.product.name = apply(next.product.name);
      return next;
    case 'product.category':
      next.product.category = apply(next.product.category);
      return next;
    case 'product.description':
      next.product.description = apply(next.product.description);
      return next;
    case 'product.intendedUse':
      next.product.intendedUse = apply(next.product.intendedUse);
      return next;
    case 'product.targetUserContext':
      next.product.targetUserContext = apply(next.product.targetUserContext);
      return next;
    case 'product.reversible':
      next.product.reversible = apply(next.product.reversible);
      return next;
    default:
      break;
  }

  let match = path.match(/^product\.notes\[([^\]]+)\]\.text$/);
  if (match !== null) {
    const note = findById(next.product.notes, capture(match, 1, path), path);
    note.text = apply(note.text);
    return next;
  }

  match = path.match(/^billOfMaterials\.items\[([^\]]+)\]\.(component|placement|material|composition|specification|weightGsm|color|quantity|notes)$/);
  if (match !== null) {
    const item = findById(next.billOfMaterials.items, capture(match, 1, path), path);
    switch (capture(match, 2, path)) {
      case 'component': item.component = apply(item.component); break;
      case 'placement': item.placement = apply(item.placement); break;
      case 'material': item.material = apply(item.material); break;
      case 'composition': item.composition = apply(item.composition); break;
      case 'specification': item.specification = apply(item.specification); break;
      case 'weightGsm': item.weightGsm = apply(item.weightGsm); break;
      case 'color': item.color = apply(item.color); break;
      case 'quantity': item.quantity = apply(item.quantity); break;
      case 'notes': item.notes = apply(item.notes); break;
      default: throw new Error(`Unregistered canonical claim: ${path}`);
    }
    return next;
  }

  match = path.match(/^measurements\.sizes\[([^\]]+)\]\.label$/);
  if (match !== null) {
    const size = findById(next.measurements.sizes, capture(match, 1, path), path);
    size.label = apply(size.label);
    return next;
  }

  match = path.match(/^measurements\.points\[([^\]]+)\]\.(pointOfMeasure|measurementInstruction|tolerance)$/);
  if (match !== null) {
    const point = findById(next.measurements.points, capture(match, 1, path), path);
    switch (capture(match, 2, path)) {
      case 'pointOfMeasure': point.pointOfMeasure = apply(point.pointOfMeasure); break;
      case 'measurementInstruction': point.measurementInstruction = apply(point.measurementInstruction); break;
      case 'tolerance': point.tolerance = apply(point.tolerance); break;
      default: throw new Error(`Unregistered canonical claim: ${path}`);
    }
    return next;
  }

  match = path.match(/^measurements\.points\[([^\]]+)\]\.values\[([^\]]+)\]\.measurement$/);
  if (match !== null) {
    const point = findById(next.measurements.points, capture(match, 1, path), path);
    const sizeId = capture(match, 2, path);
    const cell = point.values.find((candidate) => candidate.sizeId === sizeId);
    if (cell === undefined) throw new Error(`No canonical claim exists at ${path}`);
    cell.measurement = apply(cell.measurement);
    return next;
  }

  match = path.match(/^construction\.instructions\[([^\]]+)\]\.(instruction|notes)$/);
  if (match !== null) {
    const instruction = findById(next.construction.instructions, capture(match, 1, path), path);
    if (capture(match, 2, path) === 'instruction') {
      instruction.instruction = apply(instruction.instruction);
    } else {
      instruction.notes = apply(instruction.notes);
    }
    return next;
  }

  match = path.match(/^colorConfiguration\.reversibleSides\[([^\]]+)\]\.color$/);
  if (match !== null) {
    const side = findById(next.colorConfiguration.reversibleSides, capture(match, 1, path), path);
    side.color = apply(side.color);
    return next;
  }

  match = path.match(/^colorConfiguration\.colorways\[([^\]]+)\]\.name$/);
  if (match !== null) {
    const colorway = findById(next.colorConfiguration.colorways, capture(match, 1, path), path);
    colorway.name = apply(colorway.name);
    return next;
  }

  match = path.match(/^colorConfiguration\.colorways\[([^\]]+)\]\.components\[([^\]]+)\]\.color$/);
  if (match !== null) {
    const colorway = findById(next.colorConfiguration.colorways, capture(match, 1, path), path);
    const component = findById(colorway.components, capture(match, 2, path), path);
    component.color = apply(component.color);
    return next;
  }

  throw new Error(`Unregistered canonical claim: ${path}`);
}

/**
 * Presentation adapter for the registry-defined canonical paths. It deliberately
 * accepts only a path that selectUnresolvedItems could have emitted; it does not
 * create a second, UI-owned assumptions model.
 */
export function confirmClaimAtPath(content: TechPackContent, path: string): TechPackContent {
  return transitionClaimAtPath(content, path, (claim, claimPath) =>
    confirmClaim(claim, confirmationDetail(claimPath)),
  );
}

export function applyBuyerSpecificationAtPath(
  content: TechPackContent,
  path: string,
  value: BuyerSpecificationValue,
): TechPackContent {
  return transitionClaimAtPath(content, path, (claim, claimPath) =>
    editClaim(claim, value, { buyerDetail: specificationDetail(claimPath) }),
  );
}
