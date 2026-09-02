# AI Tech Pack Generator — Architecture

## 1. Goal and product boundary

Build a single-user, stateless Next.js application that accepts one product image plus a short buyer description and returns an editable, factory-oriented **draft** tech pack. The output is a manufacturing starting point, not a production-ready specification.

The product's strongest AI judgment should be visible in what it refuses to invent. A photo can support visual observations; it cannot confirm fiber composition, fabric weight, exact measurements, seam allowances, stitch density, tolerances, or hidden construction.

Every generated document must therefore show:

- `DRAFT — NOT APPROVED FOR PRODUCTION`;
- the origin of every material claim, measurement, and construction claim;
- all unresolved items that require buyer or factory confirmation;
- unknown values as unknown, never as plausible-looking fabricated precision.

## 2. Recommended application architecture

Use a **modular monolith** deployed as one Next.js application on Vercel:

```text
Browser UI
  -> one Next.js Route Handler
    -> input/image validation
    -> one multimodal LLM call with strict structured output
    -> Zod parsing + deterministic business-rule validation
  <- validated TechPack JSON
  -> editable client state
  -> structured on-screen renderer
  -> later: server-side PDF renderer from the same validated JSON
```

Recommended technical choices:

- Next.js App Router, TypeScript with strict mode, Tailwind CSS.
- Node.js runtime for the generation and future PDF routes; do not use Edge runtime.
- Zod as the single source of truth for request and tech-pack schemas. Infer TypeScript types from Zod rather than maintaining duplicate interfaces.
- One provider adapter around the LLM SDK. For OpenAI, use the Responses API with image input and strict Structured Outputs; the API supports text/image input and structured JSON output ([official OpenAI API reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)). Keep model name and prompt version in environment/config.
- One multimodal generation call, not agents and not separate “vision” and “writer” models. A bounded repair retry is allowed only when validation fails.
- No database, queue, worker, object storage, or authentication in the default challenge path.
- Client memory is the working document store. Optional `sessionStorage` can protect against an accidental refresh, but persistence is not a system of record.

This separation is enough: UI, API orchestration, provider adapter, canonical schema, semantic validator, and renderers. It keeps deployment simple without placing model-specific details throughout the app.

## 3. Canonical data model and provenance

The LLM returns one versioned `TechPack` object. It contains:

| Area | Required contents |
| --- | --- |
| Metadata | schema version, prompt version, generated timestamp, document status |
| Input evidence | original buyer description and a non-secret image fingerprint/name |
| Product | name/type, description, intended use, reversible configuration |
| BOM | component, placement, material/construction, composition, color, quantity/unit, notes |
| Measurements | unit, points of measure, at least three size columns, tolerances where known |
| Construction | ordered factory-facing operations/notes |
| Colorways | colorway name, side/panel/component mapping, color names/codes when supplied |
| Open questions | only questions linked to unresolved fields; preferably derived, not duplicated |

Every claim-bearing value uses the same provenance envelope concept:

| Property | Meaning |
| --- | --- |
| `value` | String, number, enum, or `null`. `null` is valid when the fact is unknown. |
| `source` | `buyer`, `visual_inference`, `ai_assumption`, or `derived` |
| `sourceDetail` | Buyer quote/span, visible evidence note, assumption rationale, or references to source fields |
| `confirmationStatus` | `confirmed_by_buyer`, `needs_confirmation`, or `not_applicable` |
| `confirmationQuestion` | Specific question when confirmation is required |

Rules:

- `buyer` means “stated or later confirmed by the buyer,” not independently verified fact.
- A buyer-sourced value generated from the initial description must include an exact or normalized matching quote/span. This prevents source laundering.
- `visual_inference` describes what appears visible and always remains `needs_confirmation` unless the buyer confirms it.
- `ai_assumption` always remains `needs_confirmation`.
- Any measurement not explicitly supplied by the buyer is `needs_confirmation`, even if it resembles an industry standard.
- `derived` must reference its input fields; it cannot introduce a new physical-world claim.
- Editing or confirming a field in the UI changes its provenance to buyer-confirmed for the current session.
- Do not use numeric confidence as an approval signal. If an ordinal model-confidence indicator is later added, label it as uncalibrated and keep confirmation status authoritative.

The assumptions/needs-confirmation panel should be a deterministic selector over unresolved canonical fields, not a second LLM-authored list. PDF and UI render from the same object so they cannot disagree.

## 4. Suggested directory structure

```text
src/
  app/
    page.tsx
    api/
      tech-packs/
        generate/route.ts
        export/route.ts              # deferred until PDF work
  components/
    intake/
    tech-pack/
    shared/
  lib/
    ai/
      client.ts                      # provider SDK construction
      generate-tech-pack.ts          # orchestration and bounded retry
      provider.ts                    # narrow provider interface
      prompts/
        tech-pack-v1.ts
    image/
      policy.ts
      validate.ts
    schema/
      generation-input.ts
      tech-pack.ts                    # canonical Zod schema and inferred types
    validation/
      tech-pack-rules.ts              # cross-field/business invariants
    pdf/
      TechPackDocument.tsx            # deferred
      render.ts                       # deferred
    errors/
      public-error.ts
    config.ts
tests/
  fixtures/
    bucket-hat/
  unit/
  integration/
  evals/                              # small deterministic + scored set, if time remains
public/
  samples/
```

Keep components organized by feature, not by generic atoms. Do not create a repository layer, service container, event bus, or shared package for a one-app prototype.

## 5. Data flow

1. The buyer chooses one JPEG, PNG, or WebP image and enters a description.
2. The browser shows a preview, applies EXIF orientation, strips metadata through re-encoding, resizes to a bounded dimension, and compresses to the byte limit. Line-art sketches should retain enough contrast; do not blindly convert every image to low-quality JPEG.
3. The browser sends `multipart/form-data` containing the normalized image and description to `POST /api/tech-packs/generate`.
4. The route validates text length, declared MIME type, file signature, decoded dimensions, pixel count, and byte size. It rejects unsupported or malformed files before the model call.
5. The AI service sends clearly delimited buyer text plus the image and strict JSON schema in one multimodal request. Prompt instructions define provenance semantics, forbid invented precision, permit `null`, and demand factory-oriented language.
6. The provider response must be complete and non-refused. It is parsed through the canonical Zod schema.
7. Deterministic validation enforces business invariants. A single repair request may receive the invalid JSON plus a compact list of validation errors. It may repair shape/consistency, but it may not upgrade provenance or confirmation status.
8. If valid, the server adds trusted metadata such as schema version, prompt version, generation time, and request ID. The client receives the validated object only—not raw provider output or hidden reasoning.
9. The client renders sections and derived needs-confirmation items. Edits update canonical client state and are revalidated locally.
10. Later, PDF export sends the edited canonical object to the export route, which validates it again and renders a PDF.

## 6. API boundaries

### `POST /api/tech-packs/generate`

Input: multipart form with one normalized image and one description.

Output: a small envelope containing `requestId`, validated `techPack`, and non-sensitive generation metadata. Use stable error codes with safe user messages.

Responsibilities: input validation, rate/cost guard, provider call, refusal/incomplete handling, schema parsing, semantic validation, one bounded repair attempt, and observability.

Non-responsibilities: persistence, PDF generation, section regeneration, or UI formatting.

### `POST /api/tech-packs/export` — later

Input: the complete edited `TechPack` JSON.

Output: `application/pdf`.

It must validate against the same schema and business rules again. Never accept arbitrary HTML for PDF generation.

### Future section regeneration

Only add `POST /api/tech-packs/regenerate-section` after the base flow works. It should accept the full current document, a strict section enum, and buyer feedback; return a replacement section plus its validation result. Never let a section update silently alter other sections.

## 7. Structured-output validation

Validation is layered; schema-constrained generation alone is insufficient:

1. **Request schema:** description presence/length and file policy.
2. **Provider schema constraint:** strict JSON Schema generated from the canonical Zod schema where supported.
3. **Runtime parse:** Zod `.strict()` objects, explicit enums, bounded arrays/strings, finite numbers, nullable unknowns, no silent coercion.
4. **Semantic rules:**
   - at least three unique, consistently ordered sizes;
   - one consistent unit system per measurement chart;
   - each point of measure has one cell per size;
   - no inferred measurement is buyer-confirmed;
   - no assumption is buyer-confirmed;
   - buyer provenance has supporting buyer text;
   - BOM and construction rows have stable IDs and required factory-facing fields;
   - reversible colorways map both sides/components without contradiction;
   - unknown composition, weight, tolerance, stitch or trim details remain `null`/unresolved;
   - all confirmation questions point to real unresolved field IDs.
5. **Deterministic normalization:** add IDs where safe, trim strings, and derive unresolved counts. Never “normalize” by inventing values.

After one failed repair, return a recoverable error with a retry action. Do not display partially parsed output as a valid tech pack.

## 8. Image-input strategy

For the 24-hour challenge, use in-browser normalization followed by the single generation request. Set a conservative normalized-image target of roughly 2.5–3 MB so multipart overhead remains comfortably under Vercel's current 4.5 MB Function payload limit ([Vercel limits](https://vercel.com/docs/functions/limitations)). A maximum dimension around 1600–2048 px is a sensible initial policy; tune against the bucket-hat fixture rather than assuming more pixels always improve extraction.

Security and reliability controls:

- allowlist JPEG/PNG/WebP; reject SVG, HEIC, PDFs, and animated images for the challenge;
- check magic bytes and decode the image; do not trust filename or browser MIME type;
- cap bytes, width, height, and total pixels to prevent decompression bombs;
- strip metadata and do not log image bytes, data URLs, or the buyer's full description;
- hold the normalized image only in request memory and send it directly to the provider;
- explain that the image is transmitted to the configured AI provider.

Do not introduce Blob storage solely for this fixture. If original/larger uploads become a requirement, switch to direct browser-to-object-storage upload with a short-lived token; Vercel explicitly recommends direct-to-source uploads for larger files rather than proxying media through Functions ([Vercel guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)). Anonymous direct uploads must not be enabled without an abuse-control design.

## 9. PDF strategy

Defer PDF until the validated editable web document is solid. Then render from canonical JSON on the server using `@react-pdf/renderer` (or another pure Node renderer) through the export route.

Reasons:

- deterministic layout and pagination;
- no Chromium/Puppeteer binary or browser lifecycle in a Vercel Function;
- shared data/view-model with the web renderer;
- straightforward headers, footers, page numbers, repeated table headers, draft watermark, provenance legend, and confirmation callouts.

Embed required fonts explicitly, especially if Arabic text is possible. Test long BOM rows, long construction notes, measurement tables, page breaks, and missing values. Keep the PDF renderer presentation-only; it must not call the LLM or change content.

For the challenge, browser print CSS is an acceptable demonstration fallback only if clearly labeled as provisional. Do not claim polished PDF export until generated files have been visually inspected across representative fixtures.

## 10. Failure modes to design around

| Failure | Design response |
| --- | --- |
| Model invents precise measurements/material specs | Nullable schema, provenance per value, semantic rule forcing inferred measurements and assumptions to need confirmation |
| Model labels an assumption as buyer-provided | Require supporting buyer quote/span and server-side source-consistency validation |
| Structured JSON is malformed or semantically inconsistent | Strict Structured Outputs, Zod parse, cross-field validator, one bounded repair, then a clear retryable error |
| Provider refusal, timeout, rate limit, or incomplete output | Distinct safe error codes; request ID; retry UI; no fake fallback tech pack |
| Large/corrupt/deceptive image | Client normalization plus server signature/decode/dimension/pixel/byte checks |
| Vercel request limit exceeded | Conservative normalized image cap; later direct object-storage upload if requirements grow |
| Duplicate submissions and API cost abuse | Disable submit while pending, client request key, server rate/cost guard, Vercel deployment protection for judging when possible |
| Prompt injection inside description/image | Treat buyer text and image as untrusted data, delimit them, deny tool use, and constrain output; never let input override schema/provenance rules |
| Contradictions across BOM, construction, sizes, and colorways | Cross-field semantic validation and visible unresolved conflicts rather than silent reconciliation |
| “Confidence” badge creates false trust | Make source and confirmation the primary indicators; never equate model confidence with factual verification |
| Client refresh loses edits | State this prototype limitation; optionally use session storage/export JSON, not a rushed database |
| PDF differs from edited screen | Both render from the same validated canonical object; validate again at export |
| Sensitive uploads appear in logs | Log IDs, timings, sizes, model/prompt versions, validation codes, and token usage only—not image/text contents |

Observability should be minimal but deliberate: request ID, latency by stage, provider/model and prompt versions, input byte/dimension metadata, refusal/incomplete status, validation error codes, retry count, and token usage. This is enough to debug the demo and seed a later evaluation harness.

## 11. Explicitly out of scope for 24 hours

- Authentication, accounts, roles, teams, saved projects, database, history, sync, collaboration, or audit log.
- Multi-agent orchestration, separate vision pipeline, queues, background jobs, event bus, microservices, RAG, vector database, fine-tuning, or custom model training.
- Multiple images, video, PDF input, CAD/vector extraction, automatic sketch cleanup, or image generation.
- Production grading rules for all apparel categories; optimize the schema for extensibility but validate only the challenge fixture and a few adversarial variants.
- Automated standard-size lookup presented as authoritative. Industry tables vary by market, fit, construction, and brand.
- Automatic supplier selection, costing, MOQ, lead-time, compliance certification, or purchase orders.
- Section regeneration until full-document generation and editing are reliable.
- Rich undo/redo, autosave, complex spreadsheet editing, or real-time collaboration.
- Pixel-perfect Stitch implementation before Stitch designs exist.
- Polished PDF export unless the core flow is complete early; do not add Puppeteer just to check a box.

## 12. Prioritized implementation sequence

1. **Lock the canonical Zod schema and provenance rules.** Hand-author the expected bucket-hat JSON and challenge the schema with unknowns and contradictions.
2. **Build deterministic validators and tests.** Prove size coverage, measurement confirmation, provenance, reversible colorway, and null/unknown behavior before calling a model.
3. **Create the provider adapter and versioned prompt.** Test one multimodal strict-output call against the bucket-hat fixture; add refusal/incomplete handling and one bounded repair.
4. **Implement the generation Route Handler.** Add request/file validation, limits, safe errors, request IDs, and minimal observability.
5. **Build the minimal intake and structured result renderer.** Prioritize visible source/status labels and the derived needs-confirmation panel over visual polish.
6. **Add field editing and explicit confirm actions.** Revalidate on change and update provenance deterministically.
7. **Add fixtures and a small evaluation suite.** Include the target hat, missing-description details, ambiguous colors, unsupported garment, oversized/corrupt file, and prompt-injection text. Assert schema and provenance rules deterministically; use a small rubric only for factory usefulness.
8. **Deploy early to Vercel and test production limits.** Verify environment variables, timeouts, request size, cold execution, safe logs, and repeat submissions.
9. **Only if stable, add PDF export.** Visually inspect produced pages before calling it polished.
10. **Only after that, consider section regeneration.**

## 13. Decisions to challenge

1. **“Factory-usable” needs a qualifier.** A single image and a short sentence cannot produce production-ready specifications. Position the result as a reviewable draft and make missing decisions conspicuous. This is more credible—and more impressive—than a complete-looking hallucination.
2. **No authentication is fine; no abuse control is not.** A public server-side LLM endpoint can be used by anyone at your expense. Prefer Vercel deployment protection for the judged demo or add a narrow rate/cost guard; do not build a full auth system.
3. **PDF is not the proof of AI quality.** Provenance, honest unknowns, deterministic validation, and editable structure demonstrate stronger product judgment. PDF should follow, not lead, the implementation.
4. **A confidence score is not factual confidence.** Model self-confidence is generally uncalibrated. Source, evidence, and explicit confirmation are better trust primitives.
5. **Three generated sizes can create false precision.** The schema should require three sizes for the challenge, but every unsupplied cell must remain an explicitly proposed measurement requiring confirmation. The user should be able to accept/edit a base size and grading rule later; do not imply the grade is established.
6. **Do not add a second model just to look sophisticated.** One constrained multimodal call plus strong deterministic validation provides a clearer reliability story within 24 hours and avoids compounding provenance errors.

## 14. Acceptance criteria for the bucket-hat test

The architecture is working when the fixture produces a valid editable draft that:

- attributes “plain cotton bucket hat,” “reversible,” “khaki,” “black,” and first-run context to the buyer description when present;
- does not claim verified cotton composition merely because the buyer called it cotton;
- shows at least three sizes, with every AI-proposed measurement visibly requiring confirmation;
- includes factory-oriented BOM, construction, and reversible colorway sections without inventing hidden details as facts;
- surfaces missing items such as fabric weight/weave, exact color standard, interfacing, thread, labels, seam/stitch details, tolerances, size definitions, packaging, and order quantity as targeted questions where relevant;
- preserves the draft warning and provenance in both screen and eventual PDF output.
