import { describe, expect, it } from 'vitest';

import { techPackContentSchema, validateTechPackContent } from '../src/domain/tech-pack';
import { mapGeminiDraftToTechPackContent } from '../src/lib/ai/gemini/map-draft';

const buyerDescription = "Plain cotton bucket hat, reversible, in khaki and black, for a small Egyptian apparel brand's first production run. Available in S, M, and L. Use ~280 GSM cotton.";

function mappedDraft() {
  return mapGeminiDraftToTechPackContent({
    product: { name: 'Plain cotton bucket hat', category: 'Headwear', description: 'Plain cotton bucket hat', intendedUse: 'First production run', reversible: true },
    bom: [
      { id: 'shell-a', component: 'Shell', placement: 'Side A', material: 'Cotton', composition: null, specification: 'Cotton fabric', gsm: '~280 GSM', gsmApproximate: true, color: 'Khaki', quantity: null, unit: null, notes: null },
      { id: 'shell-b', component: 'Shell', placement: 'Side B', material: 'Cotton', composition: null, specification: null, gsm: null, color: 'Black', quantity: null, unit: null, notes: null },
    ],
    measurements: { unit: 'cm', sizes: ['S', 'M', 'L'], points: [{ id: 'opening', name: 'Opening circumference', instruction: 'Measure around opening.', values: [56, 58, 60], tolerance: null }] },
    construction: [{ id: 'join', order: 1, area: 'Crown', instruction: 'Join crown and brim.' }],
    colorConfiguration: { type: 'reversible', sideA: 'Khaki', sideB: 'Black' },
    evidence: [
      { path: 'product.name', source: 'buyer', detail: 'Plain cotton bucket hat', confirmationRequired: false },
      { path: 'product.description', source: 'buyer', detail: 'Plain cotton bucket hat', confirmationRequired: false },
      { path: 'product.reversible', source: 'buyer', detail: 'reversible', confirmationRequired: false },
      { path: 'bom[0].material', source: 'buyer', detail: 'cotton', confirmationRequired: false },
      { path: 'bom[0].gsm', source: 'buyer', detail: '~280 GSM', approximate: true, confirmationRequired: false },
      { path: 'bom[0].color', source: 'buyer', detail: 'khaki', confirmationRequired: false },
      { path: 'bom[1].color', source: 'buyer', detail: 'black', confirmationRequired: false },
      { path: 'measurements.sizes[0]', source: 'buyer', detail: 'S', confirmationRequired: false },
      { path: 'measurements.sizes[1]', source: 'buyer', detail: 'M', confirmationRequired: false },
      { path: 'measurements.sizes[2]', source: 'buyer', detail: 'L', confirmationRequired: false },
      { path: 'measurements.points[0].values[0]', source: 'buyer', detail: 'S', confirmationRequired: false },
      { path: 'measurements.points[0].values[1]', source: 'buyer', detail: 'M', confirmationRequired: false },
      { path: 'measurements.points[0].values[2]', source: 'buyer', detail: 'L', confirmationRequired: false },
      { path: 'colorConfiguration.sideA', source: 'buyer', detail: 'khaki', confirmationRequired: false },
      { path: 'colorConfiguration.sideB', source: 'buyer', detail: 'black', confirmationRequired: false },
    ],
  }, buyerDescription);
}

describe('Gemini compact draft mapper', () => {
  it('maps a compact draft into canonical content that passes Zod and semantic validation', () => {
    const content = mappedDraft();
    expect(techPackContentSchema.safeParse(content).success).toBe(true);
    expect(validateTechPackContent(content)).toMatchObject({ success: true });
  });

  it('preserves ~280 GSM as numeric approximate buyer evidence', () => {
    const gsm = mappedDraft().billOfMaterials.items[0]!.weightGsm;
    expect(gsm).toMatchObject({ value: 280, precision: 'approximate', source: 'buyer', confirmationStatus: 'confirmed_by_buyer' });
  });

  it('derives explicit buyer context when the compact draft does not carry that field', () => {
    expect(mappedDraft().product.targetUserContext).toMatchObject({
      value: 'Small Egyptian apparel brand · First production run',
      source: 'buyer',
      confirmationStatus: 'confirmed_by_buyer',
    });
  });

  it('keeps buyer-provided S/M/L labels separate from generated numeric measurement provenance', () => {
    const content = mappedDraft();
    expect(content.measurements.sizes.map((size) => size.label.source)).toEqual(['buyer', 'buyer', 'buyer']);
    for (const cell of content.measurements.points[0]!.values) {
      expect(cell.measurement).toMatchObject({ source: 'ai_assumption', confirmationStatus: 'needs_confirmation' });
    }
  });

  it('preserves unknown composition, tolerance, and notes as canonical unknowns', () => {
    const content = mappedDraft();
    expect(content.billOfMaterials.items[0]!.composition).toMatchObject({ value: null, source: 'not_provided', precision: 'unknown' });
    expect(content.measurements.points[0]!.tolerance).toMatchObject({ value: null, source: 'not_provided', precision: 'unknown' });
    expect(content.construction.instructions[0]!.notes).toMatchObject({ value: null, source: 'not_provided', precision: 'unknown' });
  });

  it('maps reversible khaki/black sides and the matching BOM rows', () => {
    const content = mappedDraft();
    expect(content.colorConfiguration.reversibleSides.map((side) => [side.id, side.color.value])).toEqual([['side-a', 'Khaki'], ['side-b', 'Black']]);
    expect(content.billOfMaterials.items.map((item) => item.reversibleSideId)).toEqual(['side-a', 'side-b']);
  });

  it('never upgrades missing flat provenance to buyer-confirmed', () => {
    const content = mapGeminiDraftToTechPackContent({
      product: { name: 'Bucket hat', description: 'Bucket hat', intendedUse: 'Sample', reversible: false },
      bom: [{ component: 'Shell', material: 'Cotton' }],
      measurements: { unit: 'cm', sizes: ['S', 'M', 'L'], points: [{ name: 'Opening', instruction: 'Measure opening.', values: [56, 58, 60] }] },
      construction: [{ area: 'Crown', instruction: 'Join panels.' }],
      colorConfiguration: { type: 'conventional', sideA: 'Khaki', sideB: null },
      evidence: [
        { path: 'product.description', source: 'buyer', detail: 'Bucket hat', confirmationRequired: false },
      ],
    }, buyerDescription);
    expect(content.product.name).toMatchObject({ source: 'ai_assumption', confirmationStatus: 'needs_confirmation' });
    expect(content.product.description).toMatchObject({ source: 'buyer', confirmationStatus: 'confirmed_by_buyer' });
    expect(content.measurements.points[0]!.values[0]!.measurement).toMatchObject({ source: 'ai_assumption', confirmationStatus: 'needs_confirmation' });
  });
});
