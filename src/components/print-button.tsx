'use client';

export function PrintButton() {
  return <button className="button button--primary print-hidden" type="button" onClick={() => window.print()}>
    Export PDF
  </button>;
}
