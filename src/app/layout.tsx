import type { Metadata } from 'next';

import { TechPackProvider } from './state/tech-pack-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Masdr — AI Tech Pack Generator',
  description: 'A reviewable technical specification draft for apparel production.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TechPackProvider>{children}</TechPackProvider>
      </body>
    </html>
  );
}
