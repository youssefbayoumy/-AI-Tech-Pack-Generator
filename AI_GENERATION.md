# AI generation boundary

This repository implements the AI-generation contract and its server-side
generation route. It does not change the approved UI/domain model.

## Target integration

One configured provider makes one multimodal request with no tools, web search,
RAG, or agent loop. `AI_PROVIDER=openai` uses the existing OpenAI Responses API
adapter with `OPENAI_MODEL`; `AI_PROVIDER=openrouter` uses OpenRouter's
OpenAI-compatible chat-completions endpoint with `OPENROUTER_MODEL` (default
`qwen/qwen2.5-vl-32b-instruct:free`). Selection is deterministic and never
falls back between providers. All keys remain server-only.

`AI_PROVIDER=gemini` uses the official `@google/genai` SDK's Gemini
Interactions API with `GEMINI_MODEL` (default `gemini-3.7-flash`). Gemini sends
the approved stable instructions as `system_instruction`, then passes the
untrusted buyer-evidence payload and validated image bytes directly as local
base64 multimodal input. It sets `store: false`, uses no tools, grounding,
search, remote files, URL context, agents, or code execution, and never stores
the reference image remotely.

OpenAI uses medium reasoning effort initially. Gemini keeps its independent
`GEMINI_THINKING_LEVEL` setting at `medium`; it does not request or expose
thought text. Gemini also has its own `GEMINI_MAX_OUTPUT_TOKENS` (32,000) and
`GEMINI_TIMEOUT_MS` (180,000) defaults. The OpenRouter adapter does not reuse
either provider-specific setting or send a reasoning control implicitly. Do not
add `temperature` or `top_p` settings without a measured reason.

All three adapters reuse the canonical JSON Schema generated from
`techPackContentSchema`. OpenAI sends it through `techPackStructuredOutputFormat`
as strict `text.format`; OpenRouter maps the same schema to strict
`response_format.json_schema`; Gemini Interactions sends
`response_format: { type: 'text', mime_type: 'application/json', schema }`.
Each sends the prompt builder's stable instructions separately from untrusted
buyer evidence and the validated local image. Gemini reads only the SDK's final
`interaction.output_text`, then follows the same JSON parse, canonical Zod,
semantic validation, and one-repair pipeline as the other providers.

OpenAI and OpenRouter reuse `techPackStructuredOutputFormat`, generated from the
canonical schema. OpenAI sends it as strict `text.format`; OpenRouter maps the
same schema to strict `response_format.json_schema`. Each sends the prompt
builder's stable instructions separately from untrusted buyer evidence and the
validated local image as a base64 data URL.

Because strict JSON Schema support is mandatory, OpenRouter also sends
`provider.require_parameters=true`; it does not pin or order upstream
providers. Its output budget defaults to 32,000 tokens and its request timeout
to 180 seconds, independently configurable with
`OPENROUTER_MAX_OUTPUT_TOKENS` and `OPENROUTER_TIMEOUT_MS`. OpenAI retains its
separate 12,000-token and 60-second defaults.

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

Gemini repair remains Gemini-only: one initial Interaction plus, only after
canonical Zod or semantic validation fails, one Interaction using the existing
repair prompt, original evidence, invalid output, and validation errors. There
is no cross-provider fallback and no third call.

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

## Future golden diagnostic

Once a real Gemini key is available, add only these server-side values to
`.env.local`:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.7-flash
GEMINI_THINKING_LEVEL=medium
GEMINI_MAX_OUTPUT_TOKENS=32000
GEMINI_TIMEOUT_MS=180000
```

Then run `npm run diagnostic:build; npm run diagnostic:golden`.
The harness invokes the same production generation service with the bucket-hat
reference and writes one safe JSON summary only: provider/model, duration,
provider-call count, interaction/output state, JSON/Zod/semantic results,
repair result, final category, and the successful draft's unresolved and
grouped-decision counts. It never prints keys, prompts, buyer text, image data,
raw model output, or thought content.
