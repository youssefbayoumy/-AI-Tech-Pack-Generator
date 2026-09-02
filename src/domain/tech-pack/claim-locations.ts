import type { Claim, TechPackContent } from './schema';

export const techPackSectionSchemaValues = [
  'product',
  'bill_of_materials',
  'measurements',
  'construction',
  'color_configuration',
] as const;

export type TechPackSection = (typeof techPackSectionSchemaValues)[number];

export interface LocatedClaim {
  canonicalPath: string;
  section: TechPackSection;
  fieldLabel: string;
  unit: string | null;
  claim: Claim<unknown>;
}

function located(
  canonicalPath: string,
  section: TechPackSection,
  fieldLabel: string,
  claim: Claim<unknown>,
  unit: string | null = null,
): LocatedClaim {
  return { canonicalPath, section, fieldLabel, unit, claim };
}

function contextLabel(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

export function collectClaimLocations(content: TechPackContent): LocatedClaim[] {
  const claims: LocatedClaim[] = [
    located('product.name', 'product', 'Product name', content.product.name),
    located('product.category', 'product', 'Product category', content.product.category),
    located('product.description', 'product', 'Product description', content.product.description),
    located('product.intendedUse', 'product', 'Intended use', content.product.intendedUse),
    located(
      'product.targetUserContext',
      'product',
      'Target user or context',
      content.product.targetUserContext,
    ),
    located('product.reversible', 'product', 'Reversible product', content.product.reversible),
  ];

  content.product.notes.forEach((note, index) => {
    claims.push(
      located(`product.notes[${note.id}].text`, 'product', `Product note ${index + 1}`, note.text),
    );
  });

  content.billOfMaterials.items.forEach((item, index) => {
    const base = `billOfMaterials.items[${item.id}]`;
    const prefix = contextLabel(item.component.value, `Material item ${index + 1}`);
    claims.push(
      located(`${base}.component`, 'bill_of_materials', `${prefix} — Component`, item.component),
      located(`${base}.placement`, 'bill_of_materials', `${prefix} — Placement`, item.placement),
      located(`${base}.material`, 'bill_of_materials', `${prefix} — Material`, item.material),
      located(`${base}.composition`, 'bill_of_materials', `${prefix} — Composition`, item.composition),
      located(
        `${base}.specification`,
        'bill_of_materials',
        `${prefix} — Specification`,
        item.specification,
      ),
      located(`${base}.weightGsm`, 'bill_of_materials', `${prefix} — Fabric weight`, item.weightGsm, 'GSM'),
      located(`${base}.color`, 'bill_of_materials', `${prefix} — Color`, item.color),
      located(`${base}.quantity`, 'bill_of_materials', `${prefix} — Consumption`, item.quantity),
      located(`${base}.notes`, 'bill_of_materials', `${prefix} — Additional specification`, item.notes),
    );
  });

  content.measurements.sizes.forEach((size, index) => {
    claims.push(
      located(
        `measurements.sizes[${size.id}].label`,
        'measurements',
        `Size label${size.label.value === null ? ` ${index + 1}` : ` — ${size.label.value}`}`,
        size.label,
      ),
    );
  });

  content.measurements.points.forEach((point, pointIndex) => {
    const base = `measurements.points[${point.id}]`;
    const prefix = contextLabel(point.pointOfMeasure.value, `Measurement ${pointIndex + 1}`);
    claims.push(
      located(
        `${base}.pointOfMeasure`,
        'measurements',
        `${prefix} — Point of measure`,
        point.pointOfMeasure,
      ),
      located(
        `${base}.measurementInstruction`,
        'measurements',
        `${prefix} — How to measure`,
        point.measurementInstruction,
      ),
      located(`${base}.tolerance`, 'measurements', `${prefix} — Tolerance`, point.tolerance, content.measurements.unit),
    );

    for (const cell of point.values) {
      const size = content.measurements.sizes.find((candidate) => candidate.id === cell.sizeId);
      const sizeLabel = contextLabel(size?.label.value, 'Unlabelled size');
      claims.push(
        located(
          `${base}.values[${cell.sizeId}].measurement`,
          'measurements',
          `${prefix} — Size ${sizeLabel}`,
          cell.measurement,
          content.measurements.unit,
        ),
      );
    }
  });

  for (const instruction of content.construction.instructions) {
    const base = `construction.instructions[${instruction.id}]`;
    claims.push(
      located(
        `${base}.instruction`,
        'construction',
        `${instruction.componentArea} instruction`,
        instruction.instruction,
      ),
      located(
        `${base}.notes`,
        'construction',
        `${instruction.componentArea} notes`,
        instruction.notes,
      ),
    );
  }

  for (const side of content.colorConfiguration.reversibleSides) {
    claims.push(
      located(
        `colorConfiguration.reversibleSides[${side.id}].color`,
        'color_configuration',
        `${side.label} — Color`,
        side.color,
      ),
    );
  }

  content.colorConfiguration.colorways.forEach((colorway, colorwayIndex) => {
    const base = `colorConfiguration.colorways[${colorway.id}]`;
    const prefix = contextLabel(colorway.name.value, `Colorway ${colorwayIndex + 1}`);
    claims.push(
      located(`${base}.name`, 'color_configuration', `${prefix} — Colorway name`, colorway.name),
    );
    for (const component of colorway.components) {
      claims.push(
        located(
          `${base}.components[${component.id}].color`,
          'color_configuration',
          `${component.component} — Color`,
          component.color,
        ),
      );
    }
  });

  return claims;
}
