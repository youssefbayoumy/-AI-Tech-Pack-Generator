'use client';

import Link from 'next/link';

import { useTechPack } from '../app/state/tech-pack-provider';
import { AppHeader } from './app-header';
import { EmptyTechPack } from './empty-tech-pack';
import type { ReviewDecision } from '../presentation/review-decisions';

function readableValue(value: unknown): string {
  if (value === null) return 'Not specified';
  if (typeof value === 'object') return 'Structured value';
  return String(value);
}

function actionCopy(decision: ReviewDecision): string {
  if (decision.action === 'add_specification') return 'Add specification';
  if (decision.action === 'confirm_proposed_values') return `Confirm ${decision.proposedItems.length} proposed value${decision.proposedItems.length === 1 ? '' : 's'}`;
  return 'Add specification';
}

function decisionState(decision: ReviewDecision): string {
  if (decision.action === 'add_specification') return 'SPECIFICATION REQUIRED';
  if (decision.action === 'confirm_proposed_values') return 'PROPOSED VALUES';
  return 'MIXED REVIEW';
}

export function ReviewScreen() {
  const { document, reviewDecisions, confirmReviewDecision } = useTechPack();
  if (document === null) return <EmptyTechPack />;
  const underlyingFieldCount = reviewDecisions.reduce((count, decision) => count + decision.items.length, 0);
  return <main className="review-page"><AppHeader />
    <section className="review-hero"><div><p className="eyebrow">REVIEW / PRODUCTION DECISIONS</p><h1>Review assumptions</h1><p>Resolve the manufacturing decisions that matter most. Each decision is derived from the shared technical draft and keeps its affected fields together.</p></div><div className="review-count"><strong>{reviewDecisions.length}</strong><span>decisions require review</span><small>{underlyingFieldCount} underlying fields</small></div></section>
    <section className="review-list" aria-label="Tech pack review decisions">
      {reviewDecisions.length === 0 ? <div className="all-reviewed"><p className="eyebrow">REVIEW COMPLETE</p><h2>No unresolved decisions remain.</h2><Link className="button button--primary" href="/workspace">Return to workspace</Link></div> : reviewDecisions.map((decision, index) => <article className="review-card" id={decision.id} key={decision.id}>
        <div className="review-card__number">{String(index + 1).padStart(2, '0')}</div>
        <div className="review-card__body"><div className="review-card__title"><div><span className="review-tag">PRODUCTION DECISION</span><h2>{decision.title}</h2></div><span className={decision.unknownItems.length > 0 ? 'state-tag state-tag--unknown' : 'state-tag'}>{decisionState(decision)}</span></div>
          <dl className="review-details"><div><dt>Why it matters</dt><dd>{decision.whyItMatters}</dd></div><div><dt>Known / proposed</dt><dd>{decision.proposedItems.length === 0 ? 'No proposed value' : `${decision.proposedItems.length} proposed value${decision.proposedItems.length === 1 ? '' : 's'}`}</dd></div><div><dt>Still unresolved</dt><dd className={decision.unknownItems.length > 0 ? 'unknown-value' : ''}>{decision.unknownItems.length === 0 ? 'No missing specifications' : `${decision.unknownItems.length} specification${decision.unknownItems.length === 1 ? '' : 's'} needed`}</dd></div></dl>
          {decision.proposedItems.length > 0 ? <div className="decision-values"><p className="eyebrow">PROPOSED VALUES</p>{decision.proposedItems.slice(0, 6).map((item) => <p key={item.id}><strong>{item.fieldLabel}</strong><span>{readableValue(item.currentValue)}</span></p>)}{decision.proposedItems.length > 6 ? <p className="decision-more">+ {decision.proposedItems.length - 6} more proposed fields</p> : null}</div> : null}
          {decision.unknownItems.length > 0 ? <details className="decision-fields"><summary>{decision.unknownItems.length} affected field{decision.unknownItems.length === 1 ? '' : 's'} need a specification</summary><ul>{decision.unknownItems.map((item) => <li key={item.id}>{item.fieldLabel}: {item.confirmationQuestion}</li>)}</ul></details> : null}
          <div className="review-card__actions">{decision.unknownItems.length > 0 ? <button type="button" className="button button--secondary" disabled>{actionCopy(decision)}</button> : null}{decision.proposedItems.length > 0 ? <button type="button" className="button button--primary" onClick={() => confirmReviewDecision(decision)}>Confirm proposed values</button> : null}{decision.unknownItems.length > 0 ? <p>Add the buyer&apos;s specification before confirming this decision.</p> : null}</div>
        </div>
      </article>)}
    </section>
  </main>;
}
