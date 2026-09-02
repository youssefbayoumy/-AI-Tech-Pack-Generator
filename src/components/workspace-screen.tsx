'use client';

import Link from 'next/link';

import { useTechPack } from '../app/state/tech-pack-provider';
import { AppHeader } from './app-header';
import { EmptyTechPack } from './empty-tech-pack';
import { NeedsConfirmation } from './needs-confirmation';
import { TechPackDocumentView } from './tech-pack-document';

export function WorkspaceScreen() {
  const { document } = useTechPack();
  if (document === null) return <EmptyTechPack />;
  return <main className="workspace-page"><AppHeader />
    <div className="workspace-toolbar"><div><p className="eyebrow">WORKSPACE / TECHNICAL DRAFT</p><h1>{document.content.product.name.value}</h1></div><div className="toolbar-actions"><Link className="button button--secondary" href="/review">Review assumptions</Link><Link className="button button--primary" href="/export">Export preview <span>→</span></Link></div></div>
    <div className="workspace-layout"><div className="document-canvas"><TechPackDocumentView content={document.content} /></div><NeedsConfirmation /></div>
  </main>;
}
