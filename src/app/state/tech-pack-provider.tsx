'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { bucketHatDocumentFixture } from '../../demo/bucket-hat';
import {
  selectUnresolvedItems,
  techPackDocumentSchema,
  type TechPackDocument,
} from '../../domain/tech-pack';
import {
  groupUnresolvedForReview,
  selectBuyerProvidedReviewItems,
  type ReviewDecision,
} from '../../presentation/review-decisions';
import {
  applyBuyerSpecificationAtPath,
  confirmClaimAtPath,
  type BuyerSpecificationValue,
} from './review-actions';

interface TechPackState {
  document: TechPackDocument | null;
  buyerReferenceImageUrl: string | null;
  reviewDecisions: ReviewDecision[];
  loadChallengeFixture: () => void;
  setBuyerReferenceImage: (image: File | null) => void;
  setGeneratedDocument: (document: TechPackDocument) => void;
  confirmReviewDecision: (decision: ReviewDecision) => void;
  applyBuyerSpecifications: (specifications: Array<{
    canonicalPath: string;
    value: BuyerSpecificationValue;
  }>) => void;
}

const TechPackContext = createContext<TechPackState | null>(null);

export function TechPackProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [document, setDocument] = useState<TechPackDocument | null>(null);
  const [buyerReferenceImageUrl, setBuyerReferenceImageUrl] = useState<string | null>(null);
  const buyerReferenceImageUrlRef = useRef<string | null>(null);

  const setBuyerReferenceImage = useCallback((image: File | null) => {
    if (buyerReferenceImageUrlRef.current !== null) {
      URL.revokeObjectURL(buyerReferenceImageUrlRef.current);
    }
    const nextUrl = image === null ? null : URL.createObjectURL(image);
    buyerReferenceImageUrlRef.current = nextUrl;
    setBuyerReferenceImageUrl(nextUrl);
  }, []);

  useEffect(() => () => {
    if (buyerReferenceImageUrlRef.current !== null) {
      URL.revokeObjectURL(buyerReferenceImageUrlRef.current);
    }
  }, []);

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

  const applyBuyerSpecifications = useCallback((specifications: Array<{
    canonicalPath: string;
    value: BuyerSpecificationValue;
  }>) => {
    setDocument((current) => {
      if (current === null) return current;
      const content = specifications.reduce(
        (next, specification) => applyBuyerSpecificationAtPath(
          next,
          specification.canonicalPath,
          specification.value,
        ),
        current.content,
      );
      return { ...current, content };
    });
  }, []);

  const unresolvedItems = useMemo(
    () => (document === null ? [] : selectUnresolvedItems(document.content)),
    [document],
  );
  const reviewDecisions = useMemo(
    () => groupUnresolvedForReview(
      unresolvedItems,
      document === null ? [] : selectBuyerProvidedReviewItems(document.content),
    ),
    [document, unresolvedItems],
  );

  const value = useMemo<TechPackState>(
    () => ({
      document,
      buyerReferenceImageUrl,
      reviewDecisions,
      loadChallengeFixture,
      setBuyerReferenceImage,
      setGeneratedDocument,
      confirmReviewDecision,
      applyBuyerSpecifications,
    }),
    [applyBuyerSpecifications, buyerReferenceImageUrl, confirmReviewDecision, document, loadChallengeFixture, reviewDecisions, setBuyerReferenceImage, setGeneratedDocument],
  );

  return <TechPackContext.Provider value={value}>{children}</TechPackContext.Provider>;
}

export function useTechPack(): TechPackState {
  const context = useContext(TechPackContext);
  if (context === null) throw new Error('useTechPack must be used within TechPackProvider');
  return context;
}
