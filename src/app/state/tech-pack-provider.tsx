'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { bucketHatDocumentFixture } from '../../demo/bucket-hat';
import {
  selectUnresolvedItems,
  techPackDocumentSchema,
  type TechPackDocument,
} from '../../domain/tech-pack';
import { groupUnresolvedForReview, type ReviewDecision } from '../../presentation/review-decisions';
import { confirmClaimAtPath } from './review-actions';

interface TechPackState {
  document: TechPackDocument | null;
  reviewDecisions: ReviewDecision[];
  loadChallengeFixture: () => void;
  setGeneratedDocument: (document: TechPackDocument) => void;
  confirmReviewDecision: (decision: ReviewDecision) => void;
}

const TechPackContext = createContext<TechPackState | null>(null);

export function TechPackProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [document, setDocument] = useState<TechPackDocument | null>(null);

  const loadChallengeFixture = useCallback(() => {
    setDocument(structuredClone(bucketHatDocumentFixture));
  }, []);

  const setGeneratedDocument = useCallback((nextDocument: TechPackDocument) => {
    // Keep the client working set canonical even if a future API response changes.
    setDocument(techPackDocumentSchema.parse(nextDocument));
  }, []);

  const confirmReviewDecision = useCallback((decision: ReviewDecision) => {
    setDocument((current) => {
      if (current === null) return current;
      const content = decision.proposedItems.reduce(
        (next, item) => confirmClaimAtPath(next, item.canonicalPath),
        current.content,
      );
      return {
        ...current,
        content,
      };
    });
  }, []);

  const unresolvedItems = useMemo(
    () => (document === null ? [] : selectUnresolvedItems(document.content)),
    [document],
  );
  const reviewDecisions = useMemo(
    () => groupUnresolvedForReview(unresolvedItems),
    [unresolvedItems],
  );

  const value = useMemo<TechPackState>(
    () => ({
      document,
      reviewDecisions,
      loadChallengeFixture,
      setGeneratedDocument,
      confirmReviewDecision,
    }),
    [confirmReviewDecision, document, loadChallengeFixture, reviewDecisions, setGeneratedDocument],
  );

  return <TechPackContext.Provider value={value}>{children}</TechPackContext.Provider>;
}

export function useTechPack(): TechPackState {
  const context = useContext(TechPackContext);
  if (context === null) throw new Error('useTechPack must be used within TechPackProvider');
  return context;
}
