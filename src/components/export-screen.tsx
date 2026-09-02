'use client';

import Link from 'next/link';

import { useTechPack } from '../app/state/tech-pack-provider';
import { EmptyTechPack } from './empty-tech-pack';
import { PrintButton } from './print-button';
import { TechPackDocumentView } from './tech-pack-document';

export function ExportScreen() {
  const { document, reviewDecisions } = useTechPack();
  if (document === null) return <EmptyTechPack />;
  return <main className="export-page"><header className="export-toolbar print-hidden"><Link className="brand" href="/workspace"><span className="brand-mark">M</span><span>MASDR</span></Link><div><p className="eyebrow">DOCUMENT PREVIEW</p><strong>Print-ready technical specification</strong></div><Link className="button button--secondary" href="/workspace">Back to workspace</Link><PrintButton /></header>
    <section className="export-notice"><span>!</span><p><strong>DRAFT — NOT APPROVED FOR PRODUCTION.</strong> {reviewDecisions.length} decision{reviewDecisions.length === 1 ? '' : 's'} require buyer confirmation.</p></section>
    <div className="export-sheet"><TechPackDocumentView content={document.content} preview /></div>
  </main>;
}
