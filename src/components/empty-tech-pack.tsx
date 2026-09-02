import Link from 'next/link';

export function EmptyTechPack({ destination = '/' }: Readonly<{ destination?: string }>) {
  return <main className="empty-state"><p className="eyebrow">NO ACTIVE DRAFT</p><h1>Load the challenge fixture first.</h1><p>This prototype keeps one in-memory technical draft and does not persist documents.</p><Link className="button button--primary" href={destination}>Create new tech pack</Link></main>;
}
