# AI generation boundary

This repository now defines the AI-generation contract only. It does not call
OpenAI, instantiate an SDK client, add a route, accept server uploads, wire the
Generate button, or change the approved UI/domain model.

## Target integration

The next step should use one multimodal OpenAI Responses API request with no
tools, web search, RAG, or agent loop. The primary model is `gpt-5.6-sol`;
`OPENAI_MODEL=gpt-5.6-terra` is the allowed server-only alternative. The
configuration default and permitted values live in `src/lib/ai/config.ts`.

Use medium reasoning effort initially. This task benefits from careful evidence
classification and consistency, but does not justify extreme latency by
default. Do not add `temperature` or `top_p` settings without a measured reason.

The future Responses call should attach `techPackStructuredOutputFormat` as its
strict `text.format` and send the prompt builder's stable instructions plus its
separate buyer evidence. OpenAI's Structured Outputs guidance recommends a
schema-constrained response rather than relying on an instruction to produce
valid JSON, and notes that strict mode supports a JSON Schema subset. See the
[official Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).

## Model and server responsibilities

The model returns **only** `TechPackContent`: product, BOM, measurements,
construction, and color configuration with canonical claim provenance. It never
returns document IDs, timestamps, schema/prompt versions, image hashes,
lifecycle status, or buyer-review history.

The server later validates the model content, performs at most one repair call,
then adds the metadata to form `TechPackDocument`. The current demo fixture and
review UI remain unchanged.

## Prompts and untrusted input

`src/lib/ai/prompts/tech-pack-generation.ts` contains a stable, versioned
instruction prefix (`tech-pack-v1`) and a pure builder. The builder puts buyer
description and an image descriptor into a separate, explicit evidence payload;
it does not interpolate buyer text into the stable instructions. This makes the
stable prefix suitable for later prompt caching.

The prompt treats buyer text and image content as untrusted product evidence.
Commands within either are ignored, never become instructions, and cannot alter
the output contract or expose hidden instructions. Intentionally placed
technical labels on a buyer reference board can be buyer evidence; incidental
watermarks, UI text, printed graphics, and ambiguous text cannot automatically
become manufacturing specifications.

The minimal repair prompt is separately versioned (`tech-pack-repair-v1`). It
receives the original evidence, the invalid output, and server validation errors
but may correct only those failures. It must preserve valid evidence and must
not turn unknowns into fabricated values merely to pass validation.

## Evidence and provenance

Use the approved claim envelope exactly as implemented in the domain model:

- `buyer` is an explicit buyer description fact or an unambiguous intentional
  reference annotation. It carries evidence IDs and preserves approximate
  precision such as `~280 GSM`.
- `visual_inference` is appearance-only and always needs buyer confirmation.
- `ai_assumption` is a useful proposal and always needs buyer confirmation.
- `not_provided` is a null, unknown claim when no proposal is justified.
- `derived` is deterministic only and must reference existing claim paths.

Explicit buyer description wins over a merely visual inference when the two are
unambiguous. Equally explicit conflicting buyer evidence is not silently
resolved: the disputed field is represented as `not_provided` with null/unknown
value, both evidence references and the conflict recorded in `sourceDetail` or
`rationale`, and a precise confirmation question. This is the smallest correct
representation in the approved model because its `buyer` semantics mean
confirmed-by-buyer; it does not require a new conflict subsystem.

The model must not turn missing fiber percentages, tolerances, hidden
construction, labels, packaging, stitch density, consumption, or factory
processes into facts. It may make a clearly marked proposal only when that
meaningfully improves the draft. The bucket-hat golden case therefore keeps
S/M/L labels and annotated fabric/topstitch/color facts as buyer evidence, but
marks proposed numerical measurements as assumptions and leaves unsupported
details unknown.

## Structured output and validation

`src/lib/ai/structured-output.ts` uses Zod 4's native `z.toJSONSchema` on the
existing strict `techPackContentSchema`. There is no hand-maintained duplicate
schema and no model-boundary schema is currently necessary: the canonical
content shape is already strict, object-rooted, metadata-free, and uses only
the required nullable/enum/array primitives. The exported format is strict and
named `tech_pack_content`.

If a future canonical Zod feature cannot be represented in OpenAI's supported
strict-schema subset, introduce the smallest documented projection only at the
model boundary, parse it immediately into the canonical schema, and retain all
semantic validators. Do not weaken the canonical schema to accommodate a model.

The future execution pipeline is:

```text
raw structured model output
  -> canonical Zod parse
  -> semantic validation
  -> valid TechPackContent
```

`validateModelTechPackOutput` exposes that no-network boundary. If validation
fails, make exactly one repair request using the same schema and evidence. If
the repair also fails, return a controlled generation error; do not return a
partial draft or retry indefinitely.

The small later-API error taxonomy is `invalid_input`, `unsupported_image`,
`provider_error`, `provider_timeout`, `malformed_output`,
`semantic_validation_failed`, and `repair_failed`. UI-safe copy is centralized
in `src/lib/ai/errors.ts`; logs should contain codes/IDs/timings only, never raw
image data or full buyer descriptions.

## Evaluations and tests

`tests/fixtures/ai-generation-evals.ts` catalogs future live-model cases:

1. Recruiter bucket-hat golden case.
2. Vague “make a hat” input.
3. Buyer-supplied exact measurements.
4. Conflicting evidence.
5. Prompt injection in buyer text.
6. Prompt injection inside image text.
7. Conventional non-reversible apparel.

`tests/ai-generation-contract.test.ts` is deterministic: it verifies prompt
policy presence, untrusted-data separation, version stability, schema metadata
exclusion, approximate/not-provided availability, repair payload error context,
model configuration, and eval coverage. These are contract tests, not proof of
model behavior. The catalogue is the basis for future live evals once the
Responses API adapter exists.
