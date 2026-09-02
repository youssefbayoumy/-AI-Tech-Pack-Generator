import type { Claim, TechPackContent } from '../../../domain/tech-pack';
import { geminiTechPackDraftSchema, type GeminiTechPackDraft } from './schema';

type DraftEvidence = NonNullable<GeminiTechPackDraft['evidence']>[number];
type ClaimValue = string | number | boolean | { amount: number; unit: string };

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
function containsExplicitValue(buyerDescription: string, value: ClaimValue, detail: string | null): boolean {
  const buyer = buyerDescription.toLocaleLowerCase('en');
  const quote = detail?.trim().toLocaleLowerCase('en');
  if (quote === undefined || quote.length === 0 || !buyer.includes(quote)) return false;
  if (typeof value === 'boolean') return value ? /\breversible\b/.test(quote) : /\bnot reversible\b/.test(quote);
  if (typeof value === 'number') return new RegExp(`(^|[^0-9])${String(value).replace('.', '\\.')}([^0-9]|$)`).test(quote);
  if (typeof value === 'string') return buyer.includes(value.trim().toLocaleLowerCase('en'));
  return false;
}
function claimFor<T extends ClaimValue>(value: T | null, path: string, label: string, evidence: Map<string, DraftEvidence>, buyerDescription: string, approximate = false): Claim<T> {
  if (value === null) return unknown<T>(label);
  const item = evidence.get(path);
  const detail = text(item?.detail) ?? `No verified provenance was supplied for ${label}.`;
  const question = text(item?.question) ?? `Confirm ${label}.`;
  const precision = approximate || item?.approximate === true ? 'approximate' : 'exact';
  if (item?.source === 'buyer' && containsExplicitValue(buyerDescription, value, item.detail ?? null)) {
    return { value, precision, source: 'buyer', sourceDetail: detail, evidenceRefs: ['buyer-description'], derivedFrom: [], confirmationStatus: 'confirmed_by_buyer', confirmationQuestion: null, rationale: null, review: null };
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
  const evidence = new Map((draft.evidence ?? []).map((item) => [item.path, item]));
  const product = draft.product ?? {};
  const colors = draft.colorConfiguration ?? {};
  const reversibleValue = product.reversible ?? null;
  const reversible = claimFor(reversibleValue, 'product.reversible', 'whether the product is reversible', evidence, buyerDescription);
  const isReversible = reversibleValue === true || colors.type === 'reversible';

  const bomIds = new Set<string>();
  const bom = (draft.bom ?? []).map((item, index) => {
    const color = text(item.color); const sideA = text(colors.sideA)?.toLocaleLowerCase('en'); const sideB = text(colors.sideB)?.toLocaleLowerCase('en');
    const normalizedColor = color?.toLocaleLowerCase('en'); const placement = text(item.placement)?.toLocaleLowerCase('en') ?? '';
    const reversibleSideId = !isReversible ? null : normalizedColor !== null && normalizedColor === sideA ? 'side-a' : normalizedColor !== null && normalizedColor === sideB ? 'side-b' : placement.includes('side a') ? 'side-a' : placement.includes('side b') ? 'side-b' : null;
    const quantity = item.quantity !== null && item.quantity !== undefined && item.quantity > 0 && text(item.unit) !== null
      ? claimFor({ amount: item.quantity, unit: text(item.unit)! }, `bom[${index}].quantity`, `BOM quantity ${index + 1}`, evidence, buyerDescription)
      : unknown<{ amount: number; unit: string }>(`BOM quantity ${index + 1}`);
    const gsm = numberFromGsm(item.gsm);
    return {
      id: uniqueId(text(item.id), `bom-${index + 1}`, bomIds),
      component: claimFor(text(item.component), `bom[${index}].component`, `BOM component ${index + 1}`, evidence, buyerDescription),
      placement: claimFor(text(item.placement), `bom[${index}].placement`, `BOM placement ${index + 1}`, evidence, buyerDescription),
      material: claimFor(text(item.material), `bom[${index}].material`, `BOM material ${index + 1}`, evidence, buyerDescription),
      composition: claimFor(text(item.composition), `bom[${index}].composition`, `BOM composition ${index + 1}`, evidence, buyerDescription),
      specification: claimFor(text(item.specification), `bom[${index}].specification`, `BOM specification ${index + 1}`, evidence, buyerDescription, item.gsmApproximate === true),
      weightGsm: claimFor(gsm, `bom[${index}].gsm`, `BOM GSM ${index + 1}`, evidence, buyerDescription, item.gsmApproximate === true || (typeof item.gsm === 'string' && item.gsm.includes('~'))),
      color: claimFor(color, `bom[${index}].color`, `BOM color ${index + 1}`, evidence, buyerDescription), quantity,
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
    componentArea: text(item.area) ?? 'general', instruction: claimFor(text(item.instruction), `construction[${index}].instruction`, `construction instruction ${index + 1}`, evidence, buyerDescription), notes: unknown<string>(`construction notes ${index + 1}`),
  }));
  const side = (id: 'side-a' | 'side-b', label: string, value: string | null, path: string) => ({ id, label, color: claimFor(value, path, `${label} color`, evidence, buyerDescription) });
  const reversibleSides = isReversible ? [side('side-a', 'Side A', text(colors.sideA), 'colorConfiguration.sideA'), side('side-b', 'Side B', text(colors.sideB), 'colorConfiguration.sideB')] : [];
  const colorways = !isReversible ? [{ id: 'colorway-1', name: claimFor(text(colors.sideA), 'colorConfiguration.sideA', 'primary colorway', evidence, buyerDescription), components: [{ id: 'main-body', component: 'Main body', color: claimFor(text(colors.sideA), 'colorConfiguration.sideA', 'main body color', evidence, buyerDescription) }] }] : [];
  return {
    product: { name: claimFor(text(product.name), 'product.name', 'product name', evidence, buyerDescription), category: claimFor(text(product.category), 'product.category', 'product category', evidence, buyerDescription), description: claimFor(text(product.description), 'product.description', 'product description', evidence, buyerDescription), intendedUse: claimFor(text(product.intendedUse), 'product.intendedUse', 'intended use', evidence, buyerDescription), targetUserContext: buyerContextFromDescription(buyerDescription), reversible, notes: [] },
    billOfMaterials: { items: bom }, measurements: { unit: measurementDraft.unit ?? 'cm', sizes, points }, construction: { instructions: construction }, colorConfiguration: { reversibleSides, colorways },
  };
}
