# Independent review: Gemini 4 Argon High

The owner explicitly requested collaborating through Google Antigravity. A separate
`cad-lab` project was opened there and the selected model was visibly verified as
Gemini 4 Argon High. The conversation is titled **Open Source CAD Technical Review**.

The first prompt requested read-only architecture and acceptance-test review of the
public project. The response identified the existing plate experiment, distinguished
2D drafting from parametric-part modeling, and proposed concrete command tests.
The review covered the earlier plate baseline, not the subsequently implemented
drafting files; it is not an independent verification of the new implementation.
The following is a summary, not a verbatim transcript or a claim of independent benchmarking.

## Findings incorporated

| Review point | Implementation/evidence |
| --- | --- |
| Separate 2D entity/document state from OCCT part generation and transient previews. | New `web/src/drawing/model.js` and `commands.js`; the 3D experiment remains separate. |
| A chained LINE or PLINE should undo as one command. | Points remain transient until command completion; a single document transaction commits the resulting entities. Automated LINE/PLINE undo tests pass. |
| Closed polylines must preserve the closing edge for snapping. | `entityPoints` includes the final-to-first midpoint. A regression test covers it on a locked but visible layer. |
| Locale-independent coordinate grammar. | Decimal point, Cartesian comma separator, `@x,y`, and polar `@distance<angle`; ambiguous/malformed/non-finite inputs are rejected. Tests cover decimal and polar input. |
| Command-local undo and close options need explicit semantics. | `U` removes the last transient LINE/PLINE vertex; `C` closes a drawing command instead of accidentally starting CIRCLE. Regression tests pass. |
| Radius and diameter options should agree. | CIRCLE accepts `D` and a diameter; a regression test compares its radius with the direct-radius command. |
| Drawing documents need a different size budget from the five-parameter plate. | Drawing JSON and DXF export are capped at 1 MiB; plate projects retain their 64 KiB cap. 2D editing is local in the browser. |
| DXF output is not verified DWG compatibility. | The implemented DXF subset is explicit. DWG, unsupported entities, and independent CAD round-trip validation remain unimplemented/unverified. |

## Open engineering work from the review

- Window/crossing selection has since been implemented with analytical geometry tests.
- Additional snap modes and intersections; current snaps cover endpoints, midpoints, circle centers and quadrants.
- Command-first selection workflows, repeated COPY destinations, direct-distance entry, and additional modification commands.
- Delta-based history and a spatial index for large drawings; current bounded snapshot history is an early implementation, not a large-project performance claim.
- A canonical schema shared/generated across the browser and Python exporter, with import fidelity reports and independent interoperability tests.
- General feature history, constrained sketches, assemblies, layouts, dimensions, plotting, DWG and a packaged desktop application.

Licensing and format assertions in the model's answer must be checked against upstream
sources before adopting them as project policy. No claim of a complete AutoCAD replacement
or production-ready CAD certification is made.

## Subsequent implementation checks

- Browser-driven DXF export and reimport preserved a closed rectangle and two circles
  after MOVE/COPY; exported circle centers were (30,20) and (70,20), radius 5 mm.
- Browser window selection picked one circle; crossing selection picked both.
- Unsupported TEXT entities were rejected while preserving the existing drawing.
- Windows CRLF DXF input initially lost header interpretation through StringIO. Universal
  newline normalization fixed it; a regression test now covers units and entity count.
- A second read-only review was requested for commit `91b03fc`. Antigravity displayed
  an agent execution error during that round; no completed second review is claimed yet.
