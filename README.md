# MASDR — AI Tech Pack Generator

MASDR turns one apparel reference image and a short buyer description into a structured, reviewable manufacturing tech-pack draft.

## What it does

Image + buyer description → multimodal analysis → structured manufacturing draft → human review → print-ready tech pack.

The generated workspace includes the product description and intended use, bill of materials, a measurement chart across at least three sizes, construction/sewing notes, and color configuration.

## Demo

A hosted demo is not currently configured. To run the recruiter flow locally, follow the instructions below and use `public/reference/masdr-bucket-hat-reference.png` with:

> Plain cotton bucket hat, reversible, two colorways (khaki and black), for a small Egyptian apparel brand's first production run.

The **Load example** action is an explicitly offline demonstration and never replaces a failed live generation.

## Key Product Principles

- Every document is a **DRAFT — NOT APPROVED FOR PRODUCTION**.
- Buyer evidence, visual inference, AI proposals, and missing information remain distinct.
- Assumptions remain assumptions until a buyer explicitly confirms or edits them.
- Unknown values remain unknown rather than becoming plausible-looking manufacturing facts.
- Approximate evidence, such as `~280 GSM`, remains approximate throughout review and export.

## AI Engineering

The production path uses Gemini 3.7 Flash through the official `@google/genai` Interactions API for multimodal image and text generation. Gemini writes to a compact provider-specific structured contract; a deterministic mapper then creates the canonical Zod domain model. Canonical parsing, semantic validation, and at most one bounded repair run before server-owned document metadata is added.

The review UI is a deterministic projection of canonical provenance and confirmation state. Buyer edits use the same canonical transitions rather than a parallel review model. OpenAI and OpenRouter adapters remain as evidence of the provider abstraction; production does not fall back between providers.

## Run Locally

Requirements: Node.js 20+ and a Gemini API key.

```bash
npm ci
```

Create `.env.local` (it is Git-ignored):

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.7-flash
```

Optional Gemini tuning uses the existing safe defaults when omitted:

```dotenv
GEMINI_THINKING_LEVEL=medium
GEMINI_MAX_OUTPUT_TOKENS=32000
GEMINI_TIMEOUT_MS=180000
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Tests

The final deterministic suite contains **107 tests across 12 files**.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Export

Open **Export Preview**, choose **Export PDF**, then select **Save as PDF** in the browser print dialog. Print CSS uses A4 sizing, removes application chrome, preserves the draft warning, and avoids obvious section and table-row breaks.

## Limitations

- Challenge prototype with no persistence or authentication.
- Proposed manufacturing values require buyer or factory review.
- Browser print is used for PDF delivery rather than a server-side production PDF renderer.
- Output is not factory production approval.

## With One More Week

- Persistent, versioned tech packs and an explicit buyer/factory approval workflow.
- Richer visual point-of-measure annotation and grading tools.
- Costing, MOQ, and supplier/factory handoff support.
- A broader garment evaluation set with regression scoring.
- A robust server-generated production PDF after representative layout QA.
