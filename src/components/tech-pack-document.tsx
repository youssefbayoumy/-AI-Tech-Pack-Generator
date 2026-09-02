import type { Claim, TechPackContent } from '../domain/tech-pack';

function claimValue(value: unknown): string {
  if (value === null) return 'Not specified';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (typeof value === 'object' && 'amount' in value && 'unit' in value) {
    const quantity = value as { amount: unknown; unit: unknown };
    return `${String(quantity.amount)} ${String(quantity.unit)}`;
  }
  return 'Not specified';
}

export function displayClaim(claim: Claim<unknown>): string {
  const displayed = claimValue(claim.value);
  return claim.precision === 'approximate' && typeof claim.value === 'number' ? `~${displayed}` : displayed;
}

export function constructionSecondaryDisplay(claim: Claim<unknown>): string | null {
  return claim.value === null ? null : displayClaim(claim);
}

export function buyerContextDisplay(
  context: Claim<unknown>,
  intendedUse: Claim<unknown>,
): string {
  const displayedContext = displayClaim(context);
  if (context.value === null || displayedContext.includes(' · ')) return displayedContext;
  if (typeof intendedUse.value !== 'string') return displayedContext;
  const productionRun = intendedUse.value.match(/\bfirst\s+production\s+run\b/i)?.[0];
  return productionRun === undefined
    ? displayedContext
    : `${displayedContext} · ${productionRun.charAt(0).toUpperCase()}${productionRun.slice(1)}`;
}

export function bomDetailDisplay(claim: Claim<unknown>, hasDedicatedGsm: boolean): string | null {
  if (claim.value === null) return null;
  const displayed = displayClaim(claim);
  if (!hasDedicatedGsm) return displayed;
  const withoutGsm = displayed
    .replace(/(?:,?\s*)(?:approximately\s+|~)?\d+(?:\.\d+)?\s*gsm\b/i, '')
    .replace(/[\s,·]+$/, '')
    .trim();
  return withoutGsm.length > 0 ? withoutGsm : null;
}

function claimClass(claim: Claim<unknown>): string {
  if (claim.value === null) return 'claim claim--unknown';
  if (claim.confirmationStatus === 'needs_confirmation') return 'claim claim--proposed';
  return 'claim';
}

function rowNeedsReview(claims: Claim<unknown>[]): boolean {
  return claims.some((claim) => claim.confirmationStatus === 'needs_confirmation');
}

function SourceDot({ claim }: Readonly<{ claim: Claim<unknown> }>) {
  if (claim.confirmationStatus !== 'needs_confirmation') return null;
  return <span className="provenance-dot" title={claim.source === 'visual_inference' ? 'Visually inferred — confirmation required' : 'Proposed — confirmation required'} aria-label="Needs confirmation" />;
}

function ClaimText({ claim }: Readonly<{ claim: Claim<unknown> }>) {
  const label = claim.value === null || claim.confirmationStatus !== 'needs_confirmation'
    ? null
    : claim.source === 'ai_assumption'
      ? 'Proposed'
      : 'Needs confirmation';
  return <><SourceDot claim={claim} />{displayClaim(claim)}{label === null ? null : <span className="provenance-label">{label}</span>}</>;
}

export function TechPackDocumentView({ content, preview = false }: Readonly<{ content: TechPackContent; preview?: boolean }>) {
  const sizes = content.measurements.sizes;
  const isReversible = content.product.reversible.value === true;
  return (
    <article className={`tech-document ${preview ? 'tech-document--preview' : ''}`}>
      <header className="document-header">
        <div>
          <p className="eyebrow">TECHNICAL SPECIFICATION / REV 00</p>
          <h1>{displayClaim(content.product.name)}</h1>
          <p className="document-subtitle">{displayClaim(content.product.category)} · {displayClaim(content.product.intendedUse)}</p>
          <span className="document-draft">DRAFT — NOT APPROVED FOR PRODUCTION</span>
        </div>
        <figure className="garment-reference garment-reference--private">
          <figcaption>BUYER REFERENCE<br />PRIVATE INPUT · NOT PERSISTED</figcaption>
        </figure>
      </header>

      <section className="document-section">
        <div className="section-heading"><span>01</span><h2>Product Overview</h2></div>
        <p className="overview-copy">{displayClaim(content.product.description)}</p>
        <dl className="overview-grid">
          <div><dt>PRODUCT CATEGORY</dt><dd>{displayClaim(content.product.category)}</dd></div>
          <div><dt>BUYER CONTEXT</dt><dd>{buyerContextDisplay(content.product.targetUserContext, content.product.intendedUse)}</dd></div>
          <div><dt>REVERSIBLE</dt><dd>{displayClaim(content.product.reversible)}</dd></div>
        </dl>
        {content.product.notes.map((note) => <p className={claimClass(note.text)} key={note.id}><ClaimText claim={note.text} /></p>)}
      </section>

      <section className="document-section">
        <div className="section-heading"><span>02</span><h2>Bill of Materials</h2></div>
        <div className="table-wrap"><table className="spec-table"><thead><tr><th>Component</th><th>Placement</th><th>Material / Specification</th><th>Colour</th><th>Review status</th></tr></thead><tbody>
          {content.billOfMaterials.items.map((item) => {
            const details = [item.material, item.specification, item.composition]
              .map((claim) => ({ claim, displayed: bomDetailDisplay(claim, item.weightGsm.value !== null) }))
              .filter((detail, index, allDetails) => detail.displayed !== null && allDetails.findIndex((candidate) => candidate.displayed === detail.displayed) === index);
            const needsReview = rowNeedsReview([item.component, item.placement, item.material, item.composition, item.specification, item.weightGsm, item.color, item.quantity, item.notes]);
            return <tr className={needsReview ? 'is-unresolved' : ''} key={item.id}>
              <td className={claimClass(item.component)}><ClaimText claim={item.component} /></td>
              <td className={claimClass(item.placement)}><ClaimText claim={item.placement} /></td>
              <td><span className={claimClass(item.material)}>{details.length > 0 ? details.map((detail, index) => <span className="bom-detail" key={`${item.id}-${index}`}>{index > 0 ? ' · ' : null}<ClaimText claim={detail.claim} /></span>) : 'Not specified'}</span>{item.weightGsm.value !== null ? <small className={`spec-weight ${claimClass(item.weightGsm)}`}><ClaimText claim={item.weightGsm} /> GSM</small> : null}</td>
              <td className={claimClass(item.color)}><ClaimText claim={item.color} /></td>
              <td><span className={needsReview ? 'review-tag' : 'approved-tag'}>{needsReview ? 'REVIEW REQUIRED' : 'BUYER CONFIRMED'}</span></td>
            </tr>;
          })}
        </tbody></table></div>
        <p className="table-note">A dash or “Not specified” is an intentional unknown, not a manufacturing default.</p>
      </section>

      <section className="document-section">
        <div className="section-heading"><span>03</span><h2>Measurement Specification <small>({content.measurements.unit})</small></h2></div>
        <p className="measurement-note">Proposed numerical measurements remain unresolved until buyer confirmation.</p>
        <div className="table-wrap"><table className="spec-table measurement-table"><thead><tr><th>Point of Measure</th><th>How to Measure</th>{sizes.map((size) => <th key={size.id}>{displayClaim(size.label)}</th>)}<th>Tolerance</th></tr></thead><tbody>
          {content.measurements.points.map((point) => <tr className="is-unresolved" key={point.id}>
            <td className={claimClass(point.pointOfMeasure)}><ClaimText claim={point.pointOfMeasure} /></td>
            <td className={claimClass(point.measurementInstruction)}><ClaimText claim={point.measurementInstruction} /></td>
            {sizes.map((size) => {
              const cell = point.values.find((value) => value.sizeId === size.id);
              return <td className={cell === undefined ? 'claim claim--unknown' : claimClass(cell.measurement)} key={size.id}>{cell === undefined ? '—' : <ClaimText claim={cell.measurement} />}</td>;
            })}
            <td className={claimClass(point.tolerance)}>{point.tolerance.value === null ? '—' : `±${displayClaim(point.tolerance)}`}</td>
          </tr>)}
        </tbody></table></div>
      </section>

      <section className="document-section construction-section">
        <div className="section-heading"><span>04</span><h2>Construction / Sewing Notes</h2></div>
        <ol className="construction-list">{content.construction.instructions.map((instruction) => <li key={instruction.id}>
          <span className="sequence">{String(instruction.sequence).padStart(2, '0')}</span>
          <div><strong>{instruction.componentArea}</strong><p className={claimClass(instruction.instruction)}><ClaimText claim={instruction.instruction} /></p>{constructionSecondaryDisplay(instruction.notes) === null ? null : <p className={claimClass(instruction.notes)}><ClaimText claim={instruction.notes} /></p>}</div>
        </li>)}</ol>
      </section>

      <section className="document-section color-section">
        <div className="section-heading"><span>05</span><h2>{isReversible ? 'Reversible Color Configuration' : 'Color Configuration'}</h2></div>
        {isReversible ? <>
          <p className="reversible-intro">One physical reversible product. Reversing the product changes which side faces outward; these are not separate SKUs.</p>
          <div className="reversible-sides">{content.colorConfiguration.reversibleSides.map((side) => <div className="reversible-side" key={side.id}>
            <span className="colour-swatch" aria-hidden="true" />
            <div><small>{side.label}</small><strong className={claimClass(side.color)}><ClaimText claim={side.color} /></strong><span>OUTWARD-FACING ORIENTATION</span></div>
          </div>)}</div>
        </> : <div className="reversible-sides">{content.colorConfiguration.colorways.map((colorway) => <div className="reversible-side" key={colorway.id}>
          <span className="colour-swatch" aria-hidden="true" />
          <div><small>COLORWAY</small><strong className={claimClass(colorway.name)}>{displayClaim(colorway.name)}</strong><span>{colorway.components.map((component) => `${component.component}: ${displayClaim(component.color)}`).join(' · ')}</span></div>
        </div>)}</div>}
      </section>
      <footer className="document-footer">MASDR TECH PACK · DRAFT FOR REVIEW · UNKNOWN VALUES REQUIRE BUYER OR FACTORY CONFIRMATION</footer>
    </article>
  );
}
