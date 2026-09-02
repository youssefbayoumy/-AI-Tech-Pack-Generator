'use client';

import Link from 'next/link';

import { useTechPack } from '../app/state/tech-pack-provider';
import type { ReviewDecision } from '../presentation/review-decisions';

function decisionSummary(decision: ReviewDecision): string {
  const parts: string[] = [];
  if (decision.proposedItems.length > 0) {
    parts.push(`${decision.proposedItems.length} proposed value${decision.proposedItems.length === 1 ? '' : 's'}`);
  }
  if (decision.unknownItems.length > 0) {
    parts.push(`${decision.unknownItems.length} field${decision.unknownItems.length === 1 ? '' : 's'} not specified`);
  }
  return parts.join(' · ');
}

export function NeedsConfirmation({ limit = 8 }: Readonly<{ limit?: number }>) {
  const { reviewDecisions } = useTechPack();
  const visible = reviewDecisions.slice(0, limit);
  const underlyingFieldCount = reviewDecisions.reduce((count, decision) => count + decision.items.length, 0);
  return <aside className="confirmation-sidebar" aria-labelledby="needs-confirmation-title">
    <div className="confirmation-sidebar__header"><p className="eyebrow">REVIEW QUEUE</p><h2 id="needs-confirmation-title">Needs Confirmation</h2><p><strong>{reviewDecisions.length}</strong> decisions require review</p><span className="review-subcount">{underlyingFieldCount} underlying fields</span></div>
    <div className="confirmation-list">{visible.map((decision) => <Link className="confirmation-item" href={`/review#${decision.id}`} key={decision.id}>
      <div><span className="review-tag">DECISION</span><h3>{decision.title}</h3></div>
      <p className={decision.unknownItems.length > 0 ? 'unknown-value' : ''}>{decisionSummary(decision)}</p>
      <p className="confirmation-reason">{decision.whyItMatters}</p>
    </Link>)}</div>
    <Link className="review-all" href="/review">Review {reviewDecisions.length} decisions <span>→</span></Link>
  </aside>;
}
