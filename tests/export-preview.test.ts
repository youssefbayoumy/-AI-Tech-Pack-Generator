import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { bucketHatContentFixture } from '../src/demo/bucket-hat';
import { TechPackDocumentView } from '../src/components/tech-pack-document';

describe('export buyer reference image', () => {
  it('renders the in-memory buyer reference only for the export preview', () => {
    const withReference = renderToStaticMarkup(createElement(TechPackDocumentView, {
      buyerReferenceImageUrl: 'blob:buyer-reference',
      content: bucketHatContentFixture,
      preview: true,
    }));
    const workspace = renderToStaticMarkup(createElement(TechPackDocumentView, {
      content: bucketHatContentFixture,
    }));

    expect(withReference).toContain('src="blob:buyer-reference"');
    expect(withReference).toContain('alt="Buyer-supplied reference"');
    expect(withReference).toContain('Buyer-supplied reference');
    expect(withReference).toContain('Private input · not persisted');
    expect(workspace).not.toContain('Buyer-supplied reference');
  });
});
