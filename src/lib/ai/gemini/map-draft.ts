import type { Claim, TechPackContent } from '../../../domain/tech-pack';
import { geminiTechPackDraftSchema, type GeminiTechPackDraft } from './schema';

type DraftEvidence = NonNullable<GeminiTechPackDraft['evidence']>[number];
type ClaimValue = string | number | boolean | { amount: number; unit: string };

interface EvidenceResolver {
  resolve(path: string): DraftEvidence[];
  resolveSameField(path: string): DraftEvidence[];
}

function stableId(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return normalized.length > 0 && normalized.length <= 80 ? normalized : fallback;
}
function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
function numberFromGsm(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match === null ? null : Number(match[0]);
}
function buyerContextFromDescription(buyerDescription: string): Claim<string> {
  const normalized = buyerDescription.replace(/\s+/g, ' ').trim();
  const match = normalized.match(/\bfor\s+(?:a|an|the)\s+(.+?)[’']s\s+(first\s+production\s+run)\b/i);
  if (match === null) return unknown<string>('target user context');

  const businessContext = match[1]?.trim();
  const productionStage = match[2]?.trim();
  if (businessContext === undefined || productionStage === undefined) {
    return unknown<string>('target user context');
  }

  const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  return {
    value: `${sentenceCase(businessContext)} · ${sentenceCase(productionStage)}`,
    precision: 'exact',
    source: 'buyer',
    sourceDetail: match[0],
    evidenceRefs: ['buyer-description'],
    derivedFrom: [],
    confirmationStatus: 'confirmed_by_buyer',
    confirmationQuestion: null,
    rationale: null,
    review: null,
  };
}
function unknown<T>(label: string): Claim<T> {
  return { value: null, precision: 'unknown', source: 'not_provided', sourceDetail: `No reliable ${label} was provided.`, evidenceRefs: [], derivedFrom: [], confirmationStatus: 'needs_confirmation', confirmationQuestion: `Provide ${label}.`, rationale: 'No reliable value was supplied.', review: null };
}

function notApplicable<T>(label: string, dependency: string): Claim<T> {
  return { value: null, precision: 'unknown', source: 'derived', sourceDetail: `${label} is not applicable to this component.`, evidenceRefs: [], derivedFrom: [dependency], confirmationStatus: 'not_applicable', confirmationQuestion: null, rationale: 'Deterministic non-applicability; no manufacturing value was invented.', review: null };
}

function acceptsFabricGsm(item: { component?: string | null; material?: string | null; placement?: string | null }): boolean {
  const context = [item.component, item.material, item.placement]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase('en');
  if (/\b(?:thread|eyelet|grommet|drawcord|cord|zipper|zip|button|snap|hardware)\b/.test(context)) return false;
  return true;
}

function normalizedWords(value: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'and', 'apply', 'at', 'by', 'for', 'from', 'in', 'is', 'of', 'on', 'the',
    'to', 'use', 'with', 'fabric', 'material', 'colour', 'color', 'label', 'size',
    'annotation', 'board', 'buyer', 'evidence', 'reference', 'specifies', 'states',
  ]);
  return value
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !stopWords.has(word))
    .map((word) => word.length > 5 && word.endsWith('ing') ? word.slice(0, -3) : word);
}

function includesNumber(detail: string, value: number): boolean {
  return new RegExp(`(^|[^0-9])${String(value).replace('.', '\\.')}([^0-9]|$)`).test(detail);
}

/** Buyer evidence must support the actual leaf value, not merely its parent concept. */
export function evidenceSupportsValue(
  value: ClaimValue,
  detailValue: string | null | undefined,
  path = '',
): boolean {
  const detail = detailValue?.trim().toLocaleLowerCase('en');
  if (detail === undefined || detail.length === 0) return false;
  if (typeof value === 'boolean') {
    return value ? /\breversible\b/.test(detail) : /\b(?:non[- ]reversible|not reversible)\b/.test(detail);
  }
  if (typeof value === 'number') return includesNumber(detail, value);
  if (typeof value === 'object') {
    return includesNumber(detail, value.amount)
      && normalizedWords(detail).includes(value.unit.toLocaleLowerCase('en'));
  }

  const valueWords = normalizedWords(value);
  const detailWords = normalizedWords(detail);
  if (valueWords.length === 0 || detailWords.length === 0) return false;

  // A percentage or other numeric qualifier may never be sourced from a
  // weaker phrase such as "cotton" alone.
  const valueNumbers = value.match(/\d+(?:\.\d+)?/g) ?? [];
  if (valueNumbers.some((number) => !includesNumber(detail, Number(number)))) return false;
  if (value.includes('%') && !detail.includes('%')) return false;

  const allValueWordsSupported = valueWords.every((word) => detailWords.includes(word));
  const allEvidenceWordsRepresented = detailWords.every((word) => valueWords.includes(word));
  if (/^bom\[\d+\]\.(?:material|composition|specification|color)$/.test(path)) {
    return allValueWordsSupported;
  }
  return allValueWordsSupported || allEvidenceWordsRepresented;
}

function normalizeEvidencePath(pathValue: string, draft: GeminiTechPackDraft): string {
  let path = pathValue.trim().replace(/^\$\.?/, '');
  path = path
    .replace(/\.(\d+)(?=\.|$)/g, '[$1]')
    .replace(/^billOfMaterials\.items/, 'bom')
    .replace(/^construction\.instructions/, 'construction')
    .replace(/\.weightGsm$/, '.gsm')
    .replace(/(measurements\.sizes\[[^\]]+\])\.label$/, '$1')
    .replace(/(measurements\.points\[[^\]]+\])\.pointOfMeasure$/, '$1.name')
    .replace(/(measurements\.points\[[^\]]+\])\.measurementInstruction$/, '$1.instruction')
    .replace(/(measurements\.points\[[^\]]+\]\.values\[[^\]]+\])\.measurement$/, '$1');
  path = path
    .replace(/^colorConfiguration\.sideA\.color$/, 'colorConfiguration.sideA')
    .replace(/^colorConfiguration\.sideB\.color$/, 'colorConfiguration.sideB');

  const replaceCollectionId = (
    expression: RegExp,
    values: Array<{ id?: string | null }>,
    prefix: string,
  ) => path.replace(expression, (_match, rawId: string) => {
    if (/^\d+$/.test(rawId)) return `${prefix}[${rawId}]`;
    const index = values.findIndex((item) => text(item.id) === rawId);
    return index >= 0 ? `${prefix}[${index}]` : `${prefix}[${rawId}]`;
  });

  path = replaceCollectionId(/^bom\[([^\]]+)\]/, draft.bom, 'bom');
  path = replaceCollectionId(/^measurements\.points\[([^\]]+)\]/, draft.measurements.points, 'measurements.points');
  path = replaceCollectionId(/^construction\[([^\]]+)\]/, draft.construction, 'construction');
  const sizeMatch = path.match(/^measurements\.sizes\[([^\]]+)\]/);
  if (sizeMatch !== null && !/^\d+$/.test(sizeMatch[1] ?? '')) {
    const rawId = sizeMatch[1] ?? '';
    const index = draft.measurements.sizes.findIndex((label, sizeIndex) =>
      stableId(label, `size-${sizeIndex + 1}`) === rawId.replace(/^size-/, '')
      || `size-${stableId(label, String(sizeIndex + 1))}` === rawId,
    );
    if (index >= 0) path = path.replace(/^measurements\.sizes\[[^\]]+\]/, `measurements.sizes[${index}]`);
  }
  return path;
}

function evidenceCandidatePaths(path: string): string[] {
  const candidates = [path];
  if (/^measurements\.sizes\[\d+\]$/.test(path)) candidates.push('measurements.sizes');
  if (/^measurements\.points\[\d+\]\.values\[\d+\]$/.test(path)) {
    candidates.push(path.replace(/\[\d+\]$/, ''));
  }
  const itemParent = path.match(/^(bom\[\d+\]|measurements\.points\[\d+\]|construction\[\d+\])\./)?.[1];
  if (itemParent !== undefined) candidates.push(itemParent);
  return [...new Set(candidates)];
}

export function createCompactEvidenceResolver(draft: GeminiTechPackDraft): EvidenceResolver {
  const evidenceByPath = new Map<string, DraftEvidence[]>();
  const evidenceByFieldShape = new Map<string, DraftEvidence[]>();
  for (const item of draft.evidence ?? []) {
    const path = normalizeEvidencePath(item.path, draft);
    evidenceByPath.set(path, [...(evidenceByPath.get(path) ?? []), item]);
    const shape = path.replace(/\[\d+\]/g, '[*]');
    evidenceByFieldShape.set(shape, [...(evidenceByFieldShape.get(shape) ?? []), item]);
  }
  return {
    resolve(path) {
      return evidenceCandidatePaths(path).flatMap((candidate) => evidenceByPath.get(candidate) ?? []);
    },
    resolveSameField(path) {
      return evidenceByFieldShape.get(path.replace(/\[\d+\]/g, '[*]')) ?? [];
    },
  };
}

function directDescriptionCanSupport(path: string, value: ClaimValue): boolean {
  if (typeof value !== 'string' && typeof value !== 'boolean') return false;
  return /^product\.(?:name|category|description|intendedUse|reversible)$/.test(path)
    || /^bom\[\d+\]\.(?:material|color)$/.test(path)
    || /^measurements\.sizes\[\d+\]$/.test(path)
    || /^construction\[\d+\]\.instruction$/.test(path)
    || /^colorConfiguration\.(?:sideA|sideB)$/.test(path);
}

interface ClaimMappingOptions {
  allowDescriptionEvidence?: boolean;
  allowSameFieldEvidence?: boolean;
}

function claimFor<T extends ClaimValue>(value: T | null, path: string, label: string, evidence: EvidenceResolver, buyerDescription: string, approximate = false, options: ClaimMappingOptions = {}): Claim<T> {
  if (value === null) return unknown<T>(label);
  const candidates = evidence.resolve(path);
  const semanticallyRelated = options.allowSameFieldEvidence === true
    && (typeof value === 'string' || typeof value === 'boolean')
    ? evidence.resolveSameField(path)
    : [];
  const buyerItem = [...candidates, ...semanticallyRelated].find(
    (candidate) => candidate.source === 'buyer' && evidenceSupportsValue(value, candidate.detail, path),
  );
  const descriptionSupportsValue = options.allowDescriptionEvidence !== false
    && directDescriptionCanSupport(path, value)
    && evidenceSupportsValue(value, buyerDescription, path);
  const item = buyerItem ?? candidates.find((candidate) => candidate.source !== 'buyer');
  const detail = text(item?.detail) ?? `No verified provenance was supplied for ${label}.`;
  const question = text(item?.question) ?? `Confirm ${label}.`;
  const precision = approximate || item?.approximate === true ? 'approximate' : 'exact';
  if (buyerItem !== undefined || descriptionSupportsValue) {
    const normalizedDescription = buyerDescription.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
    const normalizedDetail = detail.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
    const evidenceRef = descriptionSupportsValue || normalizedDescription.includes(normalizedDetail)
      ? 'buyer-description'
      : 'reference-image';
    const sourceDetail = descriptionSupportsValue && buyerItem === undefined
      ? buyerDescription.trim().slice(0, 500)
      : detail;
    return { value, precision, source: 'buyer', sourceDetail, evidenceRefs: [evidenceRef], derivedFrom: [], confirmationStatus: 'confirmed_by_buyer', confirmationQuestion: null, rationale: null, review: null };
  }
  if (item?.source === 'visual_inference') {
    return { value, precision, source: 'visual_inference', sourceDetail: detail, evidenceRefs: ['reference-image'], derivedFrom: [], confirmationStatus: 'needs_confirmation', confirmationQuestion: question, rationale: 'Visible appearance is not production confirmation.', review: null };
  }
  return { value, precision, source: 'ai_assumption', sourceDetail: detail, evidenceRefs: [], derivedFrom: [], confirmationStatus: 'needs_confirmation', confirmationQuestion: question, rationale: 'Proposed only; buyer confirmation is required.', review: null };
}
function uniqueId(candidate: string | null | undefined, fallback: string, used: Set<string>): string {
  const base = stableId(candidate, fallback); let id = base; let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id); return id;
}

/** Converts the compact Gemini draft into the canonical, claim-rich domain object. */
export function mapGeminiDraftToTechPackContent(rawDraft: unknown, buyerDescription: string): TechPackContent {
  const parsed = geminiTechPackDraftSchema.safeParse(rawDraft);
  if (!parsed.success) throw new TypeError('Gemini draft does not match the compact draft contract.');
  const draft = parsed.data;
  const evidence = createCompactEvidenceResolver(draft);
  const product = draft.product ?? {};
  const colors = draft.colorConfiguration ?? {};
  const reversibleValue = product.reversible ?? null;
  const reversible = claimFor(reversibleValue, 'product.reversible', 'whether the product is reversible', evidence, buyerDescription);
  const isReversible = reversibleValue === true || colors.type === 'reversible';

  const bomIds = new Set<string>();
  const bom = (draft.bom ?? []).map((item, index) => {
    const bomId = uniqueId(text(item.id), `bom-${index + 1}`, bomIds);
    const color = text(item.color); const sideA = text(colors.sideA)?.toLocaleLowerCase('en'); const sideB = text(colors.sideB)?.toLocaleLowerCase('en');
    const normalizedColor = color?.toLocaleLowerCase('en'); const placement = text(item.placement)?.toLocaleLowerCase('en') ?? '';
    const reversibleSideId = !isReversible ? null : normalizedColor !== null && normalizedColor === sideA ? 'side-a' : normalizedColor !== null && normalizedColor === sideB ? 'side-b' : placement.includes('side a') ? 'side-a' : placement.includes('side b') ? 'side-b' : null;
    const quantity = item.quantity !== null && item.quantity !== undefined && item.quantity > 0 && text(item.unit) !== null
      ? claimFor({ amount: item.quantity, unit: text(item.unit)! }, `bom[${index}].quantity`, `BOM quantity ${index + 1}`, evidence, buyerDescription)
      : unknown<{ amount: number; unit: string }>(`BOM quantity ${index + 1}`);
    const gsm = numberFromGsm(item.gsm);
    return {
      id: bomId,
      component: claimFor(text(item.component), `bom[${index}].component`, `BOM component ${index + 1}`, evidence, buyerDescription),
      placement: claimFor(text(item.placement), `bom[${index}].placement`, `BOM placement ${index + 1}`, evidence, buyerDescription),
      material: claimFor(text(item.material), `bom[${index}].material`, `BOM material ${index + 1}`, evidence, buyerDescription, false, { allowDescriptionEvidence: index === 0 || reversibleSideId !== null }),
      composition: claimFor(text(item.composition), `bom[${index}].composition`, `BOM composition ${index + 1}`, evidence, buyerDescription),
      specification: claimFor(text(item.specification), `bom[${index}].specification`, `BOM specification ${index + 1}`, evidence, buyerDescription, item.gsmApproximate === true),
      weightGsm: acceptsFabricGsm(item)
        ? claimFor(gsm, `bom[${index}].gsm`, `BOM GSM ${index + 1}`, evidence, buyerDescription, item.gsmApproximate === true || (typeof item.gsm === 'string' && item.gsm.includes('~')))
        : notApplicable<number>(`Fabric GSM for BOM item ${index + 1}`, `billOfMaterials.items[${bomId}].component`),
      color: claimFor(color, `bom[${index}].color`, `BOM color ${index + 1}`, evidence, buyerDescription, false, { allowDescriptionEvidence: index === 0 || reversibleSideId !== null }), quantity,
      notes: claimFor(text(item.notes), `bom[${index}].notes`, `BOM notes ${index + 1}`, evidence, buyerDescription), reversibleSideId,
    };
  });
  const measurementDraft = draft.measurements ?? {};
  const sizeIds = new Set<string>();
  const sizes = (measurementDraft.sizes ?? []).map((label, index) => { const value = text(label); const id = uniqueId(value === null ? null : `size-${value}`, `size-${index + 1}`, sizeIds); return { id, label: claimFor(value, `measurements.sizes[${index}]`, `size label ${index + 1}`, evidence, buyerDescription) }; });
  const pointIds = new Set<string>();
  const points = (measurementDraft.points ?? []).map((point, pointIndex) => ({
    id: uniqueId(text(point.id), `pom-${pointIndex + 1}`, pointIds),
    pointOfMeasure: claimFor(text(point.name), `measurements.points[${pointIndex}].name`, `point of measure ${pointIndex + 1}`, evidence, buyerDescription),
    measurementInstruction: claimFor(text(point.instruction), `measurements.points[${pointIndex}].instruction`, `measurement instruction ${pointIndex + 1}`, evidence, buyerDescription),
    tolerance: claimFor(point.tolerance ?? null, `measurements.points[${pointIndex}].tolerance`, `tolerance for point ${pointIndex + 1}`, evidence, buyerDescription),
    values: sizes.map((size, sizeIndex) => ({ sizeId: size.id, measurement: claimFor(point.values?.[sizeIndex] ?? null, `measurements.points[${pointIndex}].values[${sizeIndex}]`, `measurement for ${size.label.value ?? `size ${sizeIndex + 1}`}`, evidence, buyerDescription) })),
  }));
  const constructionIds = new Set<string>();
  const construction = (draft.construction ?? []).map((item, index) => ({
    id: uniqueId(text(item.id), `construction-${index + 1}`, constructionIds), sequence: item.order ?? index + 1,
    componentArea: text(item.area) ?? 'general', instruction: claimFor(text(item.instruction), `construction[${index}].instruction`, `construction instruction ${index + 1}`, evidence, buyerDescription, false, { allowSameFieldEvidence: true }), notes: claimFor(text(item.notes), `construction[${index}].notes`, `construction notes ${index + 1}`, evidence, buyerDescription),
  }));
  const side = (id: 'side-a' | 'side-b', label: string, value: string | null, path: string) => ({ id, label, color: claimFor(value, path, `${label} color`, evidence, buyerDescription) });
  const reversibleSides = isReversible ? [side('side-a', 'Side A', text(colors.sideA), 'colorConfiguration.sideA'), side('side-b', 'Side B', text(colors.sideB), 'colorConfiguration.sideB')] : [];
  const colorways = !isReversible ? [{ id: 'colorway-1', name: claimFor(text(colors.sideA), 'colorConfiguration.sideA', 'primary colorway', evidence, buyerDescription), components: [{ id: 'main-body', component: 'Main body', color: claimFor(text(colors.sideA), 'colorConfiguration.sideA', 'main body color', evidence, buyerDescription) }] }] : [];
  return {
    product: { name: claimFor(text(product.name), 'product.name', 'product name', evidence, buyerDescription), category: claimFor(text(product.category), 'product.category', 'product category', evidence, buyerDescription), description: claimFor(text(product.description), 'product.description', 'product description', evidence, buyerDescription), intendedUse: claimFor(text(product.intendedUse), 'product.intendedUse', 'intended use', evidence, buyerDescription), targetUserContext: buyerContextFromDescription(buyerDescription), reversible, notes: [] },
    billOfMaterials: { items: bom }, measurements: { unit: measurementDraft.unit ?? 'cm', sizes, points }, construction: { instructions: construction }, colorConfiguration: { reversibleSides, colorways },
  };
}
