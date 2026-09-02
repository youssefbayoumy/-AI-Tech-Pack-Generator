import type {
  Claim,
  ClaimPrecision,
  TechPackContent,
  TechPackDocument,
} from '../../src/domain/tech-pack/schema';

export const BUCKET_HAT_EVIDENCE = {
  challengeBrief: 'challenge-brief',
  referenceImageText: 'reference-image-text',
  referenceImageVisual: 'reference-image-visual',
} as const;

function buyerClaim<T>(
  value: T,
  sourceDetail: string,
  evidenceRefs: string[],
  precision: Exclude<ClaimPrecision, 'unknown'> = 'exact',
): Claim<T> {
  return {
    value,
    precision,
    source: 'buyer',
    sourceDetail,
    evidenceRefs,
    derivedFrom: [],
    confirmationStatus: 'confirmed_by_buyer',
    confirmationQuestion: null,
    rationale: null,
    review: null,
  };
}

function assumptionClaim<T>(
  value: T,
  sourceDetail: string,
  confirmationQuestion: string,
): Claim<T> {
  return {
    value,
    precision: 'exact',
    source: 'ai_assumption',
    sourceDetail,
    evidenceRefs: [],
    derivedFrom: [],
    confirmationStatus: 'needs_confirmation',
    confirmationQuestion,
    rationale: 'Proposed only to make the first manufacturing draft actionable.',
    review: null,
  };
}

function visualClaim<T>(
  value: T,
  sourceDetail: string,
  confirmationQuestion: string,
): Claim<T> {
  return {
    value,
    precision: 'exact',
    source: 'visual_inference',
    sourceDetail,
    evidenceRefs: [BUCKET_HAT_EVIDENCE.referenceImageVisual],
    derivedFrom: [],
    confirmationStatus: 'needs_confirmation',
    confirmationQuestion,
    rationale: 'Observed in the supplied illustration but not confirmed as a production detail.',
    review: null,
  };
}

function unknownClaim<T>(
  sourceDetail: string,
  confirmationQuestion: string,
): Claim<T> {
  return {
    value: null,
    precision: 'unknown',
    source: 'not_provided',
    sourceDetail,
    evidenceRefs: [],
    derivedFrom: [],
    confirmationStatus: 'needs_confirmation',
    confirmationQuestion,
    rationale: 'No reliable value was supplied.',
    review: null,
  };
}

function derivedClaim<T>(
  value: T | null,
  sourceDetail: string,
  derivedFrom: string[],
): Claim<T> {
  return {
    value,
    precision: value === null ? 'unknown' : 'exact',
    source: 'derived',
    sourceDetail,
    evidenceRefs: [],
    derivedFrom,
    confirmationStatus: 'not_applicable',
    confirmationQuestion: null,
    rationale: 'Deterministic classification or non-applicability; no new physical fact added.',
    review: null,
  };
}

const buyerReferenceRefs = [
  BUCKET_HAT_EVIDENCE.challengeBrief,
  BUCKET_HAT_EVIDENCE.referenceImageText,
];

const measurementProposal = (value: number, pom: string, size: string): Claim<number> =>
  assumptionClaim(
    value,
    `Proposed ${pom} value for ${size}; the buyer supplied only the size label.`,
    `Confirm or replace the ${pom} measurement for size ${size}.`,
  );

export const bucketHatContentFixture = {
  product: {
    name: buyerClaim(
      'Reversible Cotton-Twill Bucket Hat',
      'The brief states a plain cotton bucket hat and the reference labels it reversible.',
      buyerReferenceRefs,
    ),
    category: derivedClaim(
      'Headwear',
      'Category is deterministically classified from the buyer-provided bucket-hat product type.',
      ['product.name'],
    ),
    description: buyerClaim(
      'Plain reversible cotton-twill bucket hat with khaki and black sides.',
      'Combined from the challenge brief and reference-image text.',
      buyerReferenceRefs,
    ),
    intendedUse: buyerClaim(
      'First production run for a small Egyptian apparel brand.',
      'The challenge brief explicitly states the brand context and first production run.',
      [BUCKET_HAT_EVIDENCE.challengeBrief],
    ),
    targetUserContext: buyerClaim(
      'Small Egyptian apparel brand',
      'The challenge brief explicitly states the target business context.',
      [BUCKET_HAT_EVIDENCE.challengeBrief],
    ),
    reversible: buyerClaim(
      true,
      'The reference title and both wearing-orientation labels state that the hat is reversible.',
      [BUCKET_HAT_EVIDENCE.referenceImageText],
    ),
    notes: [
      {
        id: 'continuous-brim-appearance',
        text: visualClaim(
          'Reference illustration appears to show a continuous all-around brim.',
          'Visible silhouette in the supplied reference illustration.',
          'Confirm that the production design uses a continuous all-around brim.',
        ),
      },
    ],
  },
  billOfMaterials: {
    items: [
      {
        id: 'shell-side-a',
        component: buyerClaim(
          'Shell / Side A',
          'The reference labels the khaki outer orientation.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
        placement: buyerClaim(
          'Reversible side A',
          'The reference identifies khaki as one outward-facing side.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
        material: buyerClaim(
          'Cotton twill',
          'Reference-image text states “Cotton twill”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
        composition: unknownClaim(
          'Cotton twill does not establish an exact fiber percentage.',
          'Provide the exact fiber composition for side A.',
        ),
        specification: buyerClaim(
          'Cotton twill, approximately 280 GSM',
          'Reference-image text states “Cotton twill, ~280gsm”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
          'approximate',
        ),
        weightGsm: buyerClaim(
          280,
          'Reference-image text states “~280gsm”; 280 is preserved as approximate.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
          'approximate',
        ),
        color: buyerClaim(
          'Khaki',
          'Reference-image text states “Khaki outer / black reverse”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
        quantity: unknownClaim(
          'Material consumption was not supplied.',
          'Provide the side A material consumption per hat and unit.',
        ),
        notes: unknownClaim(
          'Fabric finish and approved color standard were not supplied.',
          'Provide side A fabric finish and approved color standard, if applicable.',
        ),
        reversibleSideId: 'side-a',
      },
      {
        id: 'shell-side-b',
        component: buyerClaim(
          'Shell / Side B',
          'The reference labels the black outer orientation.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
        placement: buyerClaim(
          'Reversible side B',
          'The reference identifies black as the other outward-facing side.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
        material: buyerClaim(
          'Cotton twill',
          'Reference-image text states “Cotton twill”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
        composition: unknownClaim(
          'Cotton twill does not establish an exact fiber percentage.',
          'Provide the exact fiber composition for side B.',
        ),
        specification: buyerClaim(
          'Cotton twill, approximately 280 GSM',
          'Reference-image text states “Cotton twill, ~280gsm”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
          'approximate',
        ),
        weightGsm: buyerClaim(
          280,
          'Reference-image text states “~280gsm”; 280 is preserved as approximate.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
          'approximate',
        ),
        color: buyerClaim(
          'Black',
          'Reference-image text states “Black outer / khaki reverse”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
        quantity: unknownClaim(
          'Material consumption was not supplied.',
          'Provide the side B material consumption per hat and unit.',
        ),
        notes: unknownClaim(
          'Fabric finish and approved color standard were not supplied.',
          'Provide side B fabric finish and approved color standard, if applicable.',
        ),
        reversibleSideId: 'side-b',
      },
      {
        id: 'sewing-thread',
        component: assumptionClaim(
          'Sewing thread',
          'Thread is required for construction but no specification was supplied.',
          'Confirm that sewing thread should be included in the BOM.',
        ),
        placement: assumptionClaim(
          'All sewn seams and brim topstitching',
          'Proposed functional placement only.',
          'Confirm thread placement and whether different threads are required.',
        ),
        material: unknownClaim(
          'Thread material was not supplied.',
          'Specify the thread material.',
        ),
        composition: unknownClaim(
          'Thread composition was not supplied.',
          'Specify the thread composition, if required.',
        ),
        specification: unknownClaim(
          'Thread ticket, finish, and performance specification were not supplied.',
          'Specify thread ticket/size, finish, and performance requirements.',
        ),
        weightGsm: derivedClaim(
          null,
          'Fabric GSM is not applicable to sewing thread.',
          ['billOfMaterials.items[sewing-thread].component'],
        ),
        color: unknownClaim(
          'Thread color was not supplied.',
          'Specify thread color for each reversible side and topstitching.',
        ),
        quantity: unknownClaim(
          'Thread consumption was not supplied.',
          'Provide or approve thread consumption per hat.',
        ),
        notes: unknownClaim(
          'No additional thread requirements were supplied.',
          'Confirm any thread performance or shade-matching requirements.',
        ),
        reversibleSideId: null,
      },
      {
        id: 'brand-label',
        component: assumptionClaim(
          'Brand label',
          'A brand label is a plausible production component but was not requested.',
          'Will this first production run include a brand label?',
        ),
        placement: unknownClaim(
          'Brand-label placement was not supplied.',
          'Specify brand-label placement, if a label is required.',
        ),
        material: unknownClaim(
          'Brand-label material was not supplied.',
          'Specify brand-label material, if applicable.',
        ),
        composition: unknownClaim(
          'Brand-label composition was not supplied.',
          'Specify brand-label composition, if applicable.',
        ),
        specification: unknownClaim(
          'Brand-label construction and dimensions were not supplied.',
          'Provide brand-label artwork, construction, and dimensions, if applicable.',
        ),
        weightGsm: derivedClaim(
          null,
          'Fabric GSM is not a required field for an unspecified brand label.',
          ['billOfMaterials.items[brand-label].component'],
        ),
        color: unknownClaim(
          'Brand-label color was not supplied.',
          'Specify brand-label colors, if applicable.',
        ),
        quantity: unknownClaim(
          'Brand-label quantity was not supplied.',
          'Specify brand-label quantity per hat, if applicable.',
        ),
        notes: unknownClaim(
          'No brand-label notes were supplied.',
          'Confirm any brand-label requirements.',
        ),
        reversibleSideId: null,
      },
    ],
  },
  measurements: {
    unit: 'cm',
    sizes: [
      {
        id: 'size-s',
        label: buyerClaim(
          'S',
          'Reference-image text states “Sizes S/M/L”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
      },
      {
        id: 'size-m',
        label: buyerClaim(
          'M',
          'Reference-image text states “Sizes S/M/L”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
      },
      {
        id: 'size-l',
        label: buyerClaim(
          'L',
          'Reference-image text states “Sizes S/M/L”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
      },
    ],
    points: [
      {
        id: 'pom-head-opening',
        pointOfMeasure: assumptionClaim(
          'Head opening circumference',
          'Proposed POM for a bucket-hat specification.',
          'Confirm that head opening circumference is required.',
        ),
        measurementInstruction: assumptionClaim(
          'Measure the inside opening circumference along the lower crown seam line.',
          'Proposed measurement method; no buyer method was supplied.',
          'Confirm or replace the head-opening measurement method.',
        ),
        tolerance: unknownClaim(
          'No measurement tolerance was supplied.',
          'Specify the allowed head-opening tolerance.',
        ),
        values: [
          { sizeId: 'size-s', measurement: measurementProposal(56, 'head opening', 'S') },
          { sizeId: 'size-m', measurement: measurementProposal(58, 'head opening', 'M') },
          { sizeId: 'size-l', measurement: measurementProposal(60, 'head opening', 'L') },
        ],
      },
      {
        id: 'pom-crown-height',
        pointOfMeasure: assumptionClaim(
          'Crown height',
          'Proposed POM for a bucket-hat specification.',
          'Confirm that crown height is required.',
        ),
        measurementInstruction: assumptionClaim(
          'Measure vertically from the crown top seam to the lower crown seam.',
          'Proposed measurement method; no buyer method was supplied.',
          'Confirm or replace the crown-height measurement method.',
        ),
        tolerance: unknownClaim(
          'No measurement tolerance was supplied.',
          'Specify the allowed crown-height tolerance.',
        ),
        values: [
          { sizeId: 'size-s', measurement: measurementProposal(8.5, 'crown height', 'S') },
          { sizeId: 'size-m', measurement: measurementProposal(9, 'crown height', 'M') },
          { sizeId: 'size-l', measurement: measurementProposal(9.5, 'crown height', 'L') },
        ],
      },
      {
        id: 'pom-brim-width',
        pointOfMeasure: assumptionClaim(
          'Brim width',
          'Proposed POM for a bucket-hat specification.',
          'Confirm that brim width is required.',
        ),
        measurementInstruction: assumptionClaim(
          'Measure from the lower crown seam to the outer brim edge.',
          'Proposed measurement method; no buyer method was supplied.',
          'Confirm or replace the brim-width measurement method.',
        ),
        tolerance: unknownClaim(
          'No measurement tolerance was supplied.',
          'Specify the allowed brim-width tolerance.',
        ),
        values: [
          { sizeId: 'size-s', measurement: measurementProposal(6, 'brim width', 'S') },
          { sizeId: 'size-m', measurement: measurementProposal(6.5, 'brim width', 'M') },
          { sizeId: 'size-l', measurement: measurementProposal(7, 'brim width', 'L') },
        ],
      },
      {
        id: 'pom-top-diameter',
        pointOfMeasure: assumptionClaim(
          'Top crown diameter',
          'Proposed POM for a bucket-hat specification.',
          'Confirm that top crown diameter is required.',
        ),
        measurementInstruction: assumptionClaim(
          'Measure across the crown top at its widest point with the hat laid flat.',
          'Proposed measurement method; no buyer method was supplied.',
          'Confirm or replace the top-diameter measurement method.',
        ),
        tolerance: unknownClaim(
          'No measurement tolerance was supplied.',
          'Specify the allowed top-crown diameter tolerance.',
        ),
        values: [
          { sizeId: 'size-s', measurement: measurementProposal(16.5, 'top diameter', 'S') },
          { sizeId: 'size-m', measurement: measurementProposal(17, 'top diameter', 'M') },
          { sizeId: 'size-l', measurement: measurementProposal(17.5, 'top diameter', 'L') },
        ],
      },
    ],
  },
  construction: {
    instructions: [
      {
        id: 'brim-topstitch',
        sequence: 1,
        componentArea: 'Brim',
        instruction: buyerClaim(
          'Apply a single row of brim topstitching.',
          'Reference-image text states “Single-row brim topstitch”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
        notes: unknownClaim(
          'Stitch type, SPI, thread, and distance from edge were not supplied.',
          'Specify stitch type, SPI, thread, and topstitch distance from the edge.',
        ),
      },
      {
        id: 'seam-allowance',
        sequence: 2,
        componentArea: 'All seams',
        instruction: unknownClaim(
          'Exact seam allowance was not supplied and cannot be inferred from the image.',
          'Specify the seam allowance for each seam.',
        ),
        notes: derivedClaim(
          null,
          'No additional note applies until seam allowance is supplied.',
          ['construction.instructions[seam-allowance].instruction'],
        ),
      },
      {
        id: 'internal-finishing',
        sequence: 3,
        componentArea: 'Reversible internal seams',
        instruction: unknownClaim(
          'Hidden seam-finishing and turning methods are not visible or supplied.',
          'Specify the reversible seam-finishing and turning method.',
        ),
        notes: unknownClaim(
          'Reinforcement and closing method were not supplied.',
          'Specify any reinforcement and closing requirements.',
        ),
      },
    ],
  },
  colorConfiguration: {
    reversibleSides: [
      {
        id: 'side-a',
        label: 'Side A / khaki outward',
        color: buyerClaim(
          'Khaki',
          'Reference-image text states “Khaki outer / black reverse”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
      },
      {
        id: 'side-b',
        label: 'Side B / black outward',
        color: buyerClaim(
          'Black',
          'Reference-image text states “Black outer / khaki reverse”.',
          [BUCKET_HAT_EVIDENCE.referenceImageText],
        ),
      },
    ],
    colorways: [],
  },
} satisfies TechPackContent;

export const bucketHatDocumentFixture = {
  metadata: {
    schemaVersion: '1.0.0',
    promptVersion: 'fixture-v1',
    generatedAt: '2026-09-02T08:00:00.000Z',
    documentId: 'bucket-hat-demo',
    imageFingerprint: `sha256:${'a'.repeat(64)}`,
    lifecycleStatus: 'draft_not_approved_for_production',
  },
  content: bucketHatContentFixture,
} satisfies TechPackDocument;
