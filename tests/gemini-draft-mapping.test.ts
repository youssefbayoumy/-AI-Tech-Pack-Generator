import { describe, expect, it } from 'vitest';

import { techPackContentSchema, validateTechPackContent } from '../src/domain/tech-pack';
import { createCompactEvidenceResolver, evidenceSupportsValue, mapGeminiDraftToTechPackContent } from '../src/lib/ai/gemini/map-draft';
import { geminiTechPackDraftSchema } from '../src/lib/ai/gemini/schema';

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
    }, 'A sample product.');
    expect(content.product.name).toMatchObject({ source: 'ai_assumption', confirmationStatus: 'needs_confirmation' });
    expect(content.product.description).toMatchObject({ source: 'buyer', confirmationStatus: 'confirmed_by_buyer' });
    expect(content.measurements.points[0]!.values[0]!.measurement).toMatchObject({ source: 'ai_assumption', confirmationStatus: 'needs_confirmation' });
  });

  it('maps broad hoodie buyer evidence to leaf claims without laundering manufacturing proposals', () => {
    const content = mapGeminiDraftToTechPackContent({
      product: { name: 'Black cotton hoodie', category: 'Hoodie', description: 'Black cotton pullover hoodie.', intendedUse: 'Casual apparel.', reversible: false },
      bom: [
        { id: 'main-body', component: 'Main body', placement: 'Body and sleeves', material: 'Cotton', composition: '100% Cotton', specification: 'French terry', gsm: 320, color: 'Black' },
        { id: 'rib', component: 'Rib knit', placement: 'Cuffs and hem', material: 'Cotton', composition: '95% cotton / 5% elastane', specification: '2x2 rib', color: 'Black' },
        { id: 'thread', component: 'Sewing thread', placement: 'All seams', material: 'Spun polyester', color: 'Black' },
      ],
      measurements: { unit: 'cm', sizes: ['S', 'M', 'L'], points: [{ id: 'chest', name: 'Chest width', instruction: 'Measure flat below armholes.', values: [52, 56, 60], tolerance: 1 }] },
      construction: [{ id: 'shoulders', area: 'Shoulders', instruction: 'Join shoulder seams.' }],
      colorConfiguration: { type: 'conventional', sideA: 'Black', sideB: null },
      evidence: [
        { path: 'product.name', source: 'buyer', detail: 'black cotton hoodie' },
        { path: 'product.category', source: 'buyer', detail: 'hoodie' },
        { path: 'bom[0].material', source: 'buyer', detail: 'cotton' },
        { path: 'bom[0].composition', source: 'buyer', detail: 'cotton' },
        { path: 'bom[0].color', source: 'buyer', detail: 'black' },
        { path: 'measurements.sizes', source: 'buyer', detail: 'S,M,L' },
        { path: 'measurements.points[0].values', source: 'buyer', detail: 'S,M,L' },
        { path: 'colorConfiguration.sideA', source: 'buyer', detail: 'black' },
      ],
    }, 'a black cotton hoodie, S,M,L');

    expect(content.product.name.source).toBe('buyer');
    expect(content.product.category.source).toBe('buyer');
    expect(content.billOfMaterials.items[0]!.material.source).toBe('buyer');
    expect(content.billOfMaterials.items[0]!.color.source).toBe('buyer');
    expect(content.measurements.sizes.map((size) => size.label.source)).toEqual(['buyer', 'buyer', 'buyer']);
    expect(content.colorConfiguration.colorways[0]!.name.source).toBe('buyer');

    expect(content.billOfMaterials.items[0]!.composition.source).toBe('ai_assumption');
    expect(content.billOfMaterials.items[0]!.weightGsm.source).toBe('ai_assumption');
    expect(content.billOfMaterials.items[1]!.composition.source).toBe('ai_assumption');
    expect(content.billOfMaterials.items[1]!.material.source).toBe('ai_assumption');
    expect(content.billOfMaterials.items[2]!.material.source).toBe('ai_assumption');
    expect(content.billOfMaterials.items[2]!.color.source).toBe('ai_assumption');
    expect(content.measurements.points[0]!.tolerance.source).toBe('ai_assumption');
    expect(content.measurements.points[0]!.values.every((cell) =>
      cell.measurement.source === 'ai_assumption'
      && cell.measurement.confirmationStatus === 'needs_confirmation')).toBe(true);
    expect(content.construction.instructions[0]!.instruction.source).toBe('ai_assumption');
  });

  it('accepts intentional reference-board annotations through compact and canonical path aliases', () => {
    const draft = geminiTechPackDraftSchema.parse({
      product: { name: 'Reversible Bucket Hat', category: 'Headwear', description: 'Plain reversible bucket hat.', intendedUse: 'First production run.', reversible: true },
      bom: [{ id: 'shell-a', component: 'Main body fabric', placement: 'Both sides', material: 'Cotton Twill', composition: null, specification: 'Cotton Twill', gsm: 280, gsmApproximate: true, color: 'Khaki' }],
      measurements: { unit: 'cm', sizes: ['S', 'M', 'L'], points: [{ id: 'opening', name: 'Head opening', instruction: 'Measure inside opening.', values: [56, 58, 60], tolerance: null }] },
      construction: [{ id: 'brim', area: 'Brim', instruction: 'Apply single-row brim topstitch.' }],
      colorConfiguration: { type: 'reversible', sideA: 'Khaki', sideB: 'Black' },
      evidence: [
        { path: 'product.name', source: 'buyer', detail: 'Reversible Bucket Hat' },
        { path: 'product.reversible', source: 'buyer', detail: 'Reversible Bucket Hat' },
        { path: 'billOfMaterials.items[shell-a].material', source: 'buyer', detail: 'Cotton Twill' },
        { path: 'bom[0].gsm', source: 'buyer', detail: '~280gsm', approximate: true },
        { path: 'measurements.sizes', source: 'buyer', detail: 'Sizes S / M / L' },
        { path: 'construction[4].instruction', source: 'buyer', detail: 'Reference board states Single-row brim topstitch' },
        { path: 'colorConfiguration.sideA', source: 'buyer', detail: 'Khaki outer / black reverse' },
        { path: 'colorConfiguration.sideB', source: 'buyer', detail: 'Black outer / khaki reverse' },
      ],
    });
    expect(createCompactEvidenceResolver(draft).resolveSameField('construction[0].instruction')).toHaveLength(1);
    expect(evidenceSupportsValue('Apply single-row brim topstitch.', 'Single-row brim topstitch')).toBe(true);
    const content = mapGeminiDraftToTechPackContent(draft, "Plain cotton bucket hat, reversible, two colorways (khaki and black), for a small Egyptian apparel brand's first production run.");

    expect(content.billOfMaterials.items[0]!.material).toMatchObject({ source: 'buyer', evidenceRefs: ['reference-image'] });
    expect(content.billOfMaterials.items[0]!.weightGsm).toMatchObject({ value: 280, precision: 'approximate', source: 'buyer' });
    expect(content.measurements.sizes.map((size) => size.label.source)).toEqual(['buyer', 'buyer', 'buyer']);
    expect(content.construction.instructions[0]!.instruction.source).toBe('buyer');
    expect(content.colorConfiguration.reversibleSides.map((side) => [side.color.value, side.color.source])).toEqual([['Khaki', 'buyer'], ['Black', 'buyer']]);
    expect(content.measurements.points[0]!.values.every((cell) => cell.measurement.source === 'ai_assumption')).toBe(true);
  });

  it('uses explicit typed description evidence for safe identity, material, color, and size leaves', () => {
    const content = mapGeminiDraftToTechPackContent({
      product: { name: 'Black cotton hoodie', category: 'Hoodie', description: 'Black cotton hoodie.', intendedUse: 'Casual wear.', reversible: false },
      bom: [{ component: 'Main body', material: 'Cotton', composition: '100% Cotton', specification: 'French terry', gsm: 320, color: 'Black' }],
      measurements: { unit: 'cm', sizes: ['S', 'M', 'L'], points: [{ name: 'Chest width', instruction: 'Measure flat.', values: [52, 56, 60], tolerance: 1 }] },
      construction: [{ area: 'Body', instruction: 'Join shoulder seams.' }],
      colorConfiguration: { type: 'conventional', sideA: 'Black', sideB: null },
      evidence: [{ path: 'product.intendedUse', source: 'ai_assumption', detail: 'Proposed use.' }],
    }, 'a black cotton hoodie, S,M,L');

    expect(content.product.name.source).toBe('buyer');
    expect(content.product.category.source).toBe('buyer');
    expect(content.billOfMaterials.items[0]!.material.source).toBe('buyer');
    expect(content.billOfMaterials.items[0]!.color.source).toBe('buyer');
    expect(content.measurements.sizes.map((size) => size.label.source)).toEqual(['buyer', 'buyer', 'buyer']);
    expect(content.colorConfiguration.colorways[0]!.name.source).toBe('buyer');
    expect(content.billOfMaterials.items[0]!.composition.source).toBe('ai_assumption');
    expect(content.billOfMaterials.items[0]!.weightGsm.source).toBe('ai_assumption');
    expect(content.measurements.points[0]!.values.every((cell) => cell.measurement.source === 'ai_assumption')).toBe(true);
  });
});
