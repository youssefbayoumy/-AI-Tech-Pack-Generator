import { confirmClaim, type TechPackContent } from '../../domain/tech-pack';

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

/**
 * Presentation adapter for the registry-defined canonical paths. It deliberately
 * accepts only a path that selectUnresolvedItems could have emitted; it does not
 * create a second, UI-owned assumptions model.
 */
export function confirmClaimAtPath(content: TechPackContent, path: string): TechPackContent {
  const next = structuredClone(content);
  const detail = confirmationDetail(path);

  switch (path) {
    case 'product.name':
      next.product.name = confirmClaim(next.product.name, detail);
      return next;
    case 'product.category':
      next.product.category = confirmClaim(next.product.category, detail);
      return next;
    case 'product.description':
      next.product.description = confirmClaim(next.product.description, detail);
      return next;
    case 'product.intendedUse':
      next.product.intendedUse = confirmClaim(next.product.intendedUse, detail);
      return next;
    case 'product.targetUserContext':
      next.product.targetUserContext = confirmClaim(next.product.targetUserContext, detail);
      return next;
    case 'product.reversible':
      next.product.reversible = confirmClaim(next.product.reversible, detail);
      return next;
    default:
      break;
  }

  let match = path.match(/^product\.notes\[([^\]]+)\]\.text$/);
  if (match !== null) {
    const note = findById(next.product.notes, capture(match, 1, path), path);
    note.text = confirmClaim(note.text, detail);
    return next;
  }

  match = path.match(/^billOfMaterials\.items\[([^\]]+)\]\.(component|placement|material|composition|specification|weightGsm|color|quantity|notes)$/);
  if (match !== null) {
    const item = findById(next.billOfMaterials.items, capture(match, 1, path), path);
    switch (capture(match, 2, path)) {
      case 'component': item.component = confirmClaim(item.component, detail); break;
      case 'placement': item.placement = confirmClaim(item.placement, detail); break;
      case 'material': item.material = confirmClaim(item.material, detail); break;
      case 'composition': item.composition = confirmClaim(item.composition, detail); break;
      case 'specification': item.specification = confirmClaim(item.specification, detail); break;
      case 'weightGsm': item.weightGsm = confirmClaim(item.weightGsm, detail); break;
      case 'color': item.color = confirmClaim(item.color, detail); break;
      case 'quantity': item.quantity = confirmClaim(item.quantity, detail); break;
      case 'notes': item.notes = confirmClaim(item.notes, detail); break;
      default: throw new Error(`Unregistered canonical claim: ${path}`);
    }
    return next;
  }

  match = path.match(/^measurements\.sizes\[([^\]]+)\]\.label$/);
  if (match !== null) {
    const size = findById(next.measurements.sizes, capture(match, 1, path), path);
    size.label = confirmClaim(size.label, detail);
    return next;
  }

  match = path.match(/^measurements\.points\[([^\]]+)\]\.(pointOfMeasure|measurementInstruction|tolerance)$/);
  if (match !== null) {
    const point = findById(next.measurements.points, capture(match, 1, path), path);
    switch (capture(match, 2, path)) {
      case 'pointOfMeasure': point.pointOfMeasure = confirmClaim(point.pointOfMeasure, detail); break;
      case 'measurementInstruction': point.measurementInstruction = confirmClaim(point.measurementInstruction, detail); break;
      case 'tolerance': point.tolerance = confirmClaim(point.tolerance, detail); break;
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
    cell.measurement = confirmClaim(cell.measurement, detail);
    return next;
  }

  match = path.match(/^construction\.instructions\[([^\]]+)\]\.(instruction|notes)$/);
  if (match !== null) {
    const instruction = findById(next.construction.instructions, capture(match, 1, path), path);
    if (capture(match, 2, path) === 'instruction') {
      instruction.instruction = confirmClaim(instruction.instruction, detail);
    } else {
      instruction.notes = confirmClaim(instruction.notes, detail);
    }
    return next;
  }

  match = path.match(/^colorConfiguration\.reversibleSides\[([^\]]+)\]\.color$/);
  if (match !== null) {
    const side = findById(next.colorConfiguration.reversibleSides, capture(match, 1, path), path);
    side.color = confirmClaim(side.color, detail);
    return next;
  }

  match = path.match(/^colorConfiguration\.colorways\[([^\]]+)\]\.name$/);
  if (match !== null) {
    const colorway = findById(next.colorConfiguration.colorways, capture(match, 1, path), path);
    colorway.name = confirmClaim(colorway.name, detail);
    return next;
  }

  match = path.match(/^colorConfiguration\.colorways\[([^\]]+)\]\.components\[([^\]]+)\]\.color$/);
  if (match !== null) {
    const colorway = findById(next.colorConfiguration.colorways, capture(match, 1, path), path);
    const component = findById(colorway.components, capture(match, 2, path), path);
    component.color = confirmClaim(component.color, detail);
    return next;
  }

  throw new Error(`Unregistered canonical claim: ${path}`);
}
