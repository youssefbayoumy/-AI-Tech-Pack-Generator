'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useTechPack } from '../app/state/tech-pack-provider';
import { AppHeader } from './app-header';
import { EmptyTechPack } from './empty-tech-pack';
import { ReviewDecisionCard, type BuyerSpecification } from './review-decision-card';

export function ReviewScreen() {
  const { document, reviewDecisions, confirmReviewDecision, applyBuyerSpecifications } = useTechPack();
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  if (document === null) return <EmptyTechPack />;
  const underlyingFieldCount = reviewDecisions.reduce((count, decision) => count + decision.items.length, 0);
  return <main className="review-page"><AppHeader />
    <section className="review-hero"><div><p className="eyebrow">REVIEW / PRODUCTION DECISIONS</p><h1>Review assumptions</h1><p>Resolve the manufacturing decisions that matter most. Each decision is derived from the shared technical draft and keeps its affected fields together.</p></div><div className="review-count"><strong>{reviewDecisions.length}</strong><span>decisions require review</span><small>{underlyingFieldCount} underlying fields</small></div></section>
    <section className="review-list" aria-label="Tech pack review decisions">
      {reviewDecisions.length === 0 ? <div className="all-reviewed"><p className="eyebrow">REVIEW COMPLETE</p><h2>No unresolved decisions remain.</h2><Link className="button button--primary" href="/workspace">Return to workspace</Link></div> : reviewDecisions.map((decision, index) => <ReviewDecisionCard key={decision.id} decision={decision} index={index} isEditing={editingDecisionId === decision.id} onStartEditing={() => setEditingDecisionId(decision.id)} onCancelEditing={() => setEditingDecisionId(null)} onSaveSpecifications={(specifications: BuyerSpecification[]) => { applyBuyerSpecifications(specifications); setEditingDecisionId(null); }} onConfirmProposedValues={() => confirmReviewDecision(decision)} />)}
    </section>
  </main>;
}
