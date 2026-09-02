# MASDR Demo Script — 2–3 Minutes

## 1. Premise — 10–15 seconds

“A buyer often starts with only a reference image and a short description, but a factory needs structured manufacturing information. MASDR creates a reviewable starting point without pretending the missing details are production truth.”

## 2. Generate the recruiter case

Upload `public/reference/masdr-bucket-hat-reference.png` and paste:

> Plain cotton bucket hat, reversible, two colorways (khaki and black), for a small Egyptian apparel brand's first production run.

Choose **Generate tech pack**. While it runs: “This is one multimodal structured generation followed by canonical and semantic validation.”

## 3. Walk through the workspace

Open the product overview, BOM, measurement chart, construction notes, and reversible color configuration.

“The reference-board facts remain buyer-supported: cotton twill, approximate 280 GSM, S/M/L, the single-row brim topstitch, and the khaki/black sides. Notice that `~280` stays approximate. Generated measurements and hidden manufacturing details remain proposals or unresolved.”

## 4. Review assumptions

Choose **Review assumptions**.

“The queue groups related fields into production decisions instead of exposing dozens of raw claims. Each card separates Buyer provided, Proposed, and Still unresolved.”

Open **Add specification** for a decision, enter one missing value such as a tolerance, and save it.

“Only that supplied field becomes buyer-confirmed. Other missing fields stay unresolved, and proposed values are not silently approved.”

Where a proposal-only group has no missing required values, confirm it to demonstrate the explicit review transition.

## 5. Export

Open **Export Preview** and choose **Export PDF**.

“The browser print dialog provides a simple Save as PDF path. The print layout removes app controls but preserves the technical sections, review status, and draft warning.”

## 6. Engineering close

“Gemini writes a compact provider contract. MASDR deterministically maps it into a canonical Zod model, applies semantic manufacturing validation, and derives every review decision from that same state. The result is useful precisely because assumptions and unknowns stay visible.”
