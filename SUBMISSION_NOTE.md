# Submission Note

## Approach

MASDR is a structured human-review workflow, not a chat wrapper. I defined a canonical apparel manufacturing model, made provenance and uncertainty part of every claim, and kept unknown information explicit. Multimodal generation first targets a compact Gemini-specific contract for reliable structured output, then a deterministic mapper produces the canonical model. Zod validation and semantic manufacturing rules run after generation, with one bounded repair opportunity. The product UI renders the same canonical draft across workspace, review, and export.

The key human decisions were the challenge scope, uncertainty and provenance rules, validation strategy, architecture boundary, review UX, and acceptance criteria. AI proposals never become production truth without a buyer action.

## Tools / Models

- Google Stitch for early UI exploration and design direction.
- Codex GPT-5.6 Sol for architecture, review, and debugging.
- Codex GPT-5.6 Terra for implementation.
- Codex Luna for mechanical and test cleanup.
- ChatGPT for planning, documentation, and control-room work.
- Gemini 3.7 Flash for runtime multimodal generation.

These tools accelerated the work; they did not make autonomous product or approval decisions.

## Next Week

I would add persistent/versioned tech packs, buyer and factory approval states, richer visual POM tooling, supplier costing, more garment evaluation cases, and a production-grade PDF/export pipeline.
