# Product direction: an AutoCAD-class drafting application

The user explicitly corrected the initial milestone: a plate generator is an
engineering experiment, not the requested product. The product direction is a
comprehensive, independent implementation of AutoCAD-style CAD workflows.
Existing geometry work remains reusable, but must not define the whole product.

## Application shell and first drafting milestone

- A drawing-first workspace with tool groups, model space, command input/history,
  coordinates, object selection, layers, and an entity properties inspector.
- Exact coordinate entry and mouse input for LINE, PLINE, CIRCLE, and RECTANG.
- MOVE, COPY, ERASE, undo/redo, zoom/pan/fit, and endpoint/center/midpoint snapping.
- Layer colors, visibility and locking, object layer changes, orthogonal drawing,
  grid display and grid snapping.
- Editable drawing save/open and real DXF interchange for the supported entity subset.
- Dimensions, additional modification commands, blocks, layouts, plotting, 3D tools
  and DWG interoperability remain separately tracked work until actually implemented.

The interface and implementation use original code and assets. Compatibility with
familiar commands and workflows does not imply copied proprietary code or branding.
Neither a familiar interface nor a handful of working commands establishes complete
AutoCAD equivalence. Feature coverage and real-file interoperability must be measured.

## Independent review through Google Antigravity

The user authorized starting the CAD project in Google Antigravity and collaborating
with the available Gemini model. The requested model name must be verified in the app.
Do not claim collaboration until a prompt has actually been submitted and a response read.

Initial division of work: Codex implements the drafting architecture; the Antigravity
model reviews public code, command semantics, missing workflows, geometry edge cases,
and concrete acceptance tests. It should not edit the same implementation files
concurrently. No private website files, credentials, or unrelated work are shared.

## Honest progress reporting

Publish meaningful commits and verification results to the existing repository.
Keep completed capabilities separate from proposed ones. The product name is still open.
