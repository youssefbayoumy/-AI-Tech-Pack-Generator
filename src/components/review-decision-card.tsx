'use client';

import { useState } from 'react';

import type { BuyerSpecificationValue } from '../app/state/review-actions';
import type { ReviewDecision } from '../presentation/review-decisions';

type SpecificationInputKind = 'text' | 'number' | 'boolean' | 'quantity';

export interface BuyerSpecification {
  canonicalPath: string;
  value: BuyerSpecificationValue;
}

export function readableReviewValue(value: unknown, precision?: 'approximate', unit?: string | null): string {
  if (value === null) return 'Not specified';
  if (typeof value === 'object' && 'amount' in value && 'unit' in value) {
    const quantity = value as { amount: unknown; unit: unknown };
    return `${String(quantity.amount)} ${String(quantity.unit)}`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const displayed = String(value);
  const precise = precision === 'approximate' && typeof value === 'number' ? `~${displayed}` : displayed;
  return unit === undefined || unit === null ? precise : `${precise} ${unit}`;
}

export function specificationInputKind(canonicalPath: string): SpecificationInputKind {
  if (canonicalPath.endsWith('.quantity')) return 'quantity';
  if (
    canonicalPath.endsWith('.weightGsm') ||
    canonicalPath.endsWith('.tolerance') ||
    canonicalPath.endsWith('.measurement')
  ) return 'number';
  if (canonicalPath === 'product.reversible') return 'boolean';
  return 'text';
}

const displayedItems = 3;

interface ReviewDecisionCardProps {
  decision: ReviewDecision;
  index: number;
  isEditing: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveSpecifications: (specifications: BuyerSpecification[]) => void;
  onConfirmProposedValues: () => void;
}

function ReviewSpecificationEditor({
  decision,
  onCancel,
  onSave,
}: Readonly<{
  decision: ReviewDecision;
  onCancel: () => void;
  onSave: (specifications: BuyerSpecification[]) => void;
}>) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [booleanValues, setBooleanValues] = useState<Record<string, '' | 'true' | 'false'>>({});

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const specifications = (): BuyerSpecification[] =>
  decision.unknownItems.flatMap((item): BuyerSpecification[] => {
    const kind = specificationInputKind(item.canonicalPath);
    if (kind === 'quantity') {
      const amount = Number(values[`${item.canonicalPath}:amount`]);
      const unit = values[`${item.canonicalPath}:unit`]?.trim();
      return Number.isFinite(amount) && amount > 0 && unit !== undefined && unit.length > 0
        ? [{ canonicalPath: item.canonicalPath, value: { amount, unit } }]
        : [];
    }
    if (kind === 'number') {
      const rawValue = values[item.canonicalPath]?.trim();
      const value = rawValue === undefined || rawValue.length === 0 ? Number.NaN : Number(rawValue);
      return Number.isFinite(value) ? [{ canonicalPath: item.canonicalPath, value }] : [];
    }
    if (kind === 'boolean') {
      const value = booleanValues[item.canonicalPath];
      return value === 'true' || value === 'false'
        ? [{ canonicalPath: item.canonicalPath, value: value === 'true' }]
        : [];
    }
    const value = values[item.canonicalPath]?.trim();
    return value === undefined || value.length === 0
      ? []
      : [{ canonicalPath: item.canonicalPath, value }];
  });

  const save = () => {
    const nextSpecifications = specifications();
    if (nextSpecifications.length > 0) onSave(nextSpecifications);
  };

  return <form className="specification-editor" aria-label={`${decision.title} specifications`} onSubmit={(event) => { event.preventDefault(); save(); }}>
    <p className="eyebrow">ADD SPECIFICATIONS</p>
    <p className="specification-editor__help">Fill only what you know. Unfilled fields stay unresolved.</p>
    <div className="specification-editor__fields">
      {decision.unknownItems.map((item) => {
        const kind = specificationInputKind(item.canonicalPath);
        const inputId = `specification-${item.id}`;
        return <div className="specification-editor__field" key={item.id}>
          <div className="specification-editor__prompt">
            <label htmlFor={inputId}>{item.fieldLabel}</label>
            <small>{item.confirmationQuestion}</small>
          </div>
          {kind === 'quantity' ? <div className="specification-editor__quantity">
            <input id={inputId} type="number" min="0" step="any" inputMode="decimal" placeholder="Amount" aria-label={`${item.fieldLabel} amount`} value={values[`${item.canonicalPath}:amount`] ?? ''} onChange={(event) => setValue(`${item.canonicalPath}:amount`, event.target.value)} />
            <input type="text" aria-label={`${item.fieldLabel} unit`} placeholder="Unit" value={values[`${item.canonicalPath}:unit`] ?? ''} onChange={(event) => setValue(`${item.canonicalPath}:unit`, event.target.value)} />
          </div> : kind === 'boolean' ? <select id={inputId} value={booleanValues[item.canonicalPath] ?? ''} onChange={(event) => setBooleanValues((current) => ({ ...current, [item.canonicalPath]: event.target.value as '' | 'true' | 'false' }))}>
            <option value="">Select</option><option value="true">Yes</option><option value="false">No</option>
          </select> : <div className="specification-editor__control"><input id={inputId} type={kind === 'number' ? 'number' : 'text'} inputMode={kind === 'number' ? 'decimal' : undefined} step={kind === 'number' ? 'any' : undefined} value={values[item.canonicalPath] ?? ''} onChange={(event) => setValue(item.canonicalPath, event.target.value)} />{kind === 'number' && item.unit !== null ? <span>{item.unit}</span> : null}</div>}
        </div>;
      })}
    </div>
    <div className="specification-editor__actions"><button className="button button--primary" type="submit" disabled={specifications().length === 0}>Save specifications</button><button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

export function ReviewDecisionCard({
  decision,
  index,
  isEditing,
  onStartEditing,
  onCancelEditing,
  onSaveSpecifications,
  onConfirmProposedValues,
}: Readonly<ReviewDecisionCardProps>) {
  const hasMissingSpecifications = decision.unknownItems.length > 0;
  return <article className="review-card" id={decision.id}>
    <div className="review-card__number">{String(index + 1).padStart(2, '0')}</div>
    <div className="review-card__body"><div className="review-card__title"><h2>{decision.title}</h2></div>
      <div className="decision-columns">
        <div className="decision-values decision-values--buyer"><p className="eyebrow">BUYER PROVIDED</p>{decision.buyerProvidedItems.length === 0 ? <p className="decision-empty">None supplied</p> : decision.buyerProvidedItems.slice(0, displayedItems).map((item) => <p key={item.id}><strong>{item.fieldLabel}</strong><span>{readableReviewValue(item.currentValue, item.precision === 'approximate' ? item.precision : undefined, item.unit)}</span></p>)}{decision.buyerProvidedItems.length > displayedItems ? <p className="decision-more">+ {decision.buyerProvidedItems.length - displayedItems} more</p> : null}</div>
        <div className="decision-values"><p className="eyebrow">AI PROPOSED</p>{decision.proposedItems.length === 0 ? <p className="decision-empty">No proposal</p> : decision.proposedItems.slice(0, displayedItems).map((item) => <p key={item.id}><strong>{item.fieldLabel}</strong><span>{readableReviewValue(item.currentValue, undefined, item.unit)}</span></p>)}{decision.proposedItems.length > displayedItems ? <p className="decision-more">+ {decision.proposedItems.length - displayedItems} more</p> : null}</div>
        <div className="decision-values decision-values--unknown"><p className="eyebrow">NEEDS YOUR INPUT</p>{decision.unknownItems.length === 0 ? <p className="decision-empty">No missing details</p> : decision.unknownItems.slice(0, displayedItems).map((item) => <p key={item.id}><strong>{item.fieldLabel}</strong></p>)}{decision.unknownItems.length > displayedItems ? <p className="decision-more">+ {decision.unknownItems.length - displayedItems} more</p> : null}</div>
      </div>
      {isEditing ? <ReviewSpecificationEditor decision={decision} onCancel={onCancelEditing} onSave={onSaveSpecifications} /> : null}
      <div className="review-card__actions">
        {hasMissingSpecifications && !isEditing ? <button type="button" className="button button--primary" onClick={onStartEditing}>ADD MISSING DETAILS</button> : null}
        {!hasMissingSpecifications && decision.proposedItems.length > 0 ? <button type="button" className="button button--primary" onClick={onConfirmProposedValues}>CONFIRM PROPOSED VALUES</button> : null}
      </div>
    </div>
  </article>;
}
