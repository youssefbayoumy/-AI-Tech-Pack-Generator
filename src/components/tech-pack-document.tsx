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

function displayClaim(claim: Claim<unknown>): string {
  const displayed = claimValue(claim.value);
  return claim.precision === 'approximate' && typeof claim.value === 'number' ? `~${displayed}` : displayed;
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
          <div><dt>BUYER CONTEXT</dt><dd>{displayClaim(content.product.targetUserContext)}</dd></div>
          <div><dt>REVERSIBLE</dt><dd>{displayClaim(content.product.reversible)}</dd></div>
        </dl>
        {content.product.notes.map((note) => <p className={claimClass(note.text)} key={note.id}><SourceDot claim={note.text} />{displayClaim(note.text)}</p>)}
      </section>

      <section className="document-section">
        <div className="section-heading"><span>02</span><h2>Bill of Materials</h2></div>
        <div className="table-wrap"><table className="spec-table"><thead><tr><th>Component</th><th>Placement</th><th>Material / Specification</th><th>Colour</th><th>Review status</th></tr></thead><tbody>
          {content.billOfMaterials.items.map((item) => {
            const details = [item.material, item.specification, item.composition].map(displayClaim).filter((value, index, values) => value !== 'Not specified' && values.indexOf(value) === index);
            const needsReview = rowNeedsReview([item.component, item.placement, item.material, item.composition, item.specification, item.weightGsm, item.color, item.quantity, item.notes]);
            return <tr className={needsReview ? 'is-unresolved' : ''} key={item.id}>
              <td className={claimClass(item.component)}><SourceDot claim={item.component} />{displayClaim(item.component)}</td>
              <td className={claimClass(item.placement)}>{displayClaim(item.placement)}</td>
              <td><span className={claimClass(item.material)}>{details.length > 0 ? details.join(' · ') : 'Not specified'}</span>{item.weightGsm.value !== null ? <small className="spec-weight">{displayClaim(item.weightGsm)} GSM</small> : null}</td>
              <td className={claimClass(item.color)}>{displayClaim(item.color)}</td>
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
            <td className={claimClass(point.pointOfMeasure)}><SourceDot claim={point.pointOfMeasure} />{displayClaim(point.pointOfMeasure)}</td>
            <td className={claimClass(point.measurementInstruction)}>{displayClaim(point.measurementInstruction)}</td>
            {sizes.map((size) => {
              const cell = point.values.find((value) => value.sizeId === size.id);
              return <td className={cell === undefined ? 'claim claim--unknown' : claimClass(cell.measurement)} key={size.id}>{cell === undefined ? '—' : <><SourceDot claim={cell.measurement} />{displayClaim(cell.measurement)}</>}</td>;
            })}
            <td className={claimClass(point.tolerance)}>{point.tolerance.value === null ? '—' : `±${displayClaim(point.tolerance)}`}</td>
          </tr>)}
        </tbody></table></div>
      </section>

      <section className="document-section construction-section">
        <div className="section-heading"><span>04</span><h2>Construction / Sewing Notes</h2></div>
        <ol className="construction-list">{content.construction.instructions.map((instruction) => <li key={instruction.id}>
          <span className="sequence">{String(instruction.sequence).padStart(2, '0')}</span>
          <div><strong>{instruction.componentArea}</strong><p className={claimClass(instruction.instruction)}><SourceDot claim={instruction.instruction} />{displayClaim(instruction.instruction)}</p><p className={claimClass(instruction.notes)}>{displayClaim(instruction.notes)}</p></div>
        </li>)}</ol>
      </section>

      <section className="document-section color-section">
        <div className="section-heading"><span>05</span><h2>{isReversible ? 'Reversible Color Configuration' : 'Color Configuration'}</h2></div>
        {isReversible ? <>
          <p className="reversible-intro">One physical reversible product. Reversing the product changes which side faces outward; these are not separate SKUs.</p>
          <div className="reversible-sides">{content.colorConfiguration.reversibleSides.map((side) => <div className="reversible-side" key={side.id}>
            <span className="colour-swatch" aria-hidden="true" />
            <div><small>{side.label}</small><strong className={claimClass(side.color)}>{displayClaim(side.color)}</strong><span>OUTWARD-FACING ORIENTATION</span></div>
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
