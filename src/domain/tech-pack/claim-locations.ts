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
  claim: Claim<unknown>;
}

function located(
  canonicalPath: string,
  section: TechPackSection,
  fieldLabel: string,
  claim: Claim<unknown>,
): LocatedClaim {
  return { canonicalPath, section, fieldLabel, claim };
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

  for (const note of content.product.notes) {
    claims.push(
      located(`product.notes[${note.id}].text`, 'product', `Product note: ${note.id}`, note.text),
    );
  }

  for (const item of content.billOfMaterials.items) {
    const base = `billOfMaterials.items[${item.id}]`;
    const prefix = `BOM ${item.id}`;
    claims.push(
      located(`${base}.component`, 'bill_of_materials', `${prefix} component`, item.component),
      located(`${base}.placement`, 'bill_of_materials', `${prefix} placement`, item.placement),
      located(`${base}.material`, 'bill_of_materials', `${prefix} material`, item.material),
      located(`${base}.composition`, 'bill_of_materials', `${prefix} composition`, item.composition),
      located(
        `${base}.specification`,
        'bill_of_materials',
        `${prefix} specification`,
        item.specification,
      ),
      located(`${base}.weightGsm`, 'bill_of_materials', `${prefix} fabric weight`, item.weightGsm),
      located(`${base}.color`, 'bill_of_materials', `${prefix} color`, item.color),
      located(`${base}.quantity`, 'bill_of_materials', `${prefix} quantity`, item.quantity),
      located(`${base}.notes`, 'bill_of_materials', `${prefix} notes`, item.notes),
    );
  }

  for (const size of content.measurements.sizes) {
    claims.push(
      located(
        `measurements.sizes[${size.id}].label`,
        'measurements',
        `Size ${size.id} label`,
        size.label,
      ),
    );
  }

  for (const point of content.measurements.points) {
    const base = `measurements.points[${point.id}]`;
    claims.push(
      located(
        `${base}.pointOfMeasure`,
        'measurements',
        `POM ${point.id} name`,
        point.pointOfMeasure,
      ),
      located(
        `${base}.measurementInstruction`,
        'measurements',
        `POM ${point.id} instruction`,
        point.measurementInstruction,
      ),
      located(`${base}.tolerance`, 'measurements', `POM ${point.id} tolerance`, point.tolerance),
    );

    for (const cell of point.values) {
      claims.push(
        located(
          `${base}.values[${cell.sizeId}].measurement`,
          'measurements',
          `POM ${point.id}, size ${cell.sizeId}`,
          cell.measurement,
        ),
      );
    }
  }

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
        `${side.label} color`,
        side.color,
      ),
    );
  }

  for (const colorway of content.colorConfiguration.colorways) {
    const base = `colorConfiguration.colorways[${colorway.id}]`;
    claims.push(
      located(`${base}.name`, 'color_configuration', `Colorway ${colorway.id} name`, colorway.name),
    );
    for (const component of colorway.components) {
      claims.push(
        located(
          `${base}.components[${component.id}].color`,
          'color_configuration',
          `${component.component} color`,
          component.color,
        ),
      );
    }
  }

  return claims;
}
