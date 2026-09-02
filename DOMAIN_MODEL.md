# Tech Pack Domain Model

The canonical contract lives in `src/domain/tech-pack`. It deliberately models a tech pack as a reviewable draft, not as approved production truth.

## Content and system metadata

- `TechPackContent` contains product, BOM, measurements, construction, and color configuration. This is the only object a future LLM may generate.
- `TechPackDocument` wraps validated content with server-owned metadata: schema/prompt versions, generation time, document ID, image hash, and the fixed `draft_not_approved_for_production` lifecycle status.
- Both schemas are strict. Model content containing a `metadata` property is rejected.

## Claims and provenance

Only claim-bearing values are wrapped. Stable IDs, collection structure, measurement units, sequence numbers, and side references remain structural.

Each `Claim<T>` includes a nullable value, precision, source detail, evidence/dependency references, confirmation status/question, rationale, and an optional lightweight review record. Sources are:

- `buyer`: explicitly supplied or later confirmed by the buyer;
- `visual_inference`: inferred from visible evidence and always initially unresolved;
- `ai_assumption`: a proposed draft value and always initially unresolved;
- `derived`: a deterministic classification or non-applicability based on referenced canonical fields;
- `not_provided`: no supplied evidence established a value. This source was added so unknown is not mislabeled as an AI assumption.

Confirmation status is authoritative. No numeric confidence is stored because model self-confidence is not factual verification.

## Precision and unknowns

`precision` is `exact`, `approximate`, or `unknown`. It describes the value's stated precision, not whether the claim is true. Null claims must use `unknown`; non-null claims cannot. The reference's `~280 GSM` is stored as numeric `280` with `precision: approximate` and buyer evidence. Exact fiber percentage remains null and `not_provided`.

## Measurements and reversible products

Size definitions and POMs use stable IDs. Measurement cells are keyed by `sizeId`, so editing does not depend on array position. Every POM must have exactly one cell for every defined size. AI-assumed and visually inferred numeric values/tolerances cannot be buyer-confirmed.

Reversibility is one product claim plus exactly `side-a` and `side-b`. The khaki-out and black-out views are wearing orientations of one physical product, not separate manufactured colorways. Conventional colorways are used only for non-reversible products.

## Needs Confirmation and review transitions

`selectUnresolvedItems` walks known claim locations and derives UI-ready unresolved records with stable canonical paths based on row IDs. No independent assumptions list is stored.

The walk is an explicit claim-location registry, not an untyped recursive object scan. This keeps paths and labels stable for editing, but adding a new claim-bearing schema field also requires adding it to the registry and its coverage test.

`confirmClaim` and `editClaim` create buyer-confirmed claims and preserve the previous source/detail in one review record. They do not implement event sourcing. A future model-generation boundary uses `phase: generation` validation and rejects review records; application-controlled reviewed content uses `phase: review`.

## Deterministic validation

`validateTechPackContent` first performs strict Zod parsing, then checks required sections, meaningful BOM material, unique IDs/size labels, at least three sizes, exact POM/size alignment, construction ordering, measurement provenance, reversible-side consistency, BOM-to-side color consistency, and the generation/review trust boundary. Errors contain stable `code`, `path`, `message`, and `severity` fields.

The recruiter bucket-hat fixture intentionally mixes buyer evidence, one visual inference, AI-proposed measurements, and legitimate unknowns. It does not claim exact composition, tolerances, seam allowance, SPI, hidden finishing, labels, or packing details.
