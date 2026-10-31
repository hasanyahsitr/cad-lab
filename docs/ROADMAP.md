# Roadmap

Progress is recorded as implemented work is verified. This is not a release-date promise.

## Current direction — AutoCAD-class drafting

The owner clarified that the plate experiment must not define the product.
The default page is now a drawing-first application; the 3D experiment remains at `/index.html`.

- [x] Exact 2D line, polyline, rectangle and circle entities, independent of the UI.
- [x] Command/prompt engine, Cartesian/relative/polar coordinates, local vertex undo and close options.
- [x] Pick/Shift selection, MOVE/COPY/ERASE, layer visibility/locking/color.
- [x] Grid, orthogonal input and endpoint/midpoint/center/quadrant snapping.
- [x] Bounded drawing history, editable JSON save/open and actual DXF export.
- [x] Independent Gemini 4 Argon High review, with incorporated tests and findings.
- [x] Supported planar/mm ASCII DXF import, explicit rejection of unsupported geometry and an import report.
- [x] Analytical window/crossing selection, including hollow-circle and closing-edge tests.
- [x] Original layered office-layout example, exact MOVE/undo check and DXF round trip.
- [x] Adaptive grid for small-part and building-scale drawings; 320/390/1280 px layout checks.
- [ ] Independent CAD interchange verification and a shared generated schema.
- [ ] Additional intersection snaps, spatial indexing and delta history.
- [ ] ARC/SPLINE, OFFSET/TRIM/EXTEND/FILLET, blocks, dimensions, layouts and plotting.
- [ ] DWG interoperability, general 3D modeling and a packaged desktop application.

The original milestones below describe the earlier reusable geometry experiment.

## Milestone 0 — independent foundation

- [x] Separate repository, original-code license, and upstream attribution.
- [x] English and Turkish project introductions.
- [x] Distinguish the product vision from implemented capabilities.

## Milestone 1 — exact geometry and round-trip files

- [x] Validated plate parameters in millimeters.
- [x] Four through-holes with edge-relative positions after dimensional changes.
- [x] Exact solid geometry and analytical volume checks.
- [x] Versioned project save/load, without executing project-provided code.
- [x] STEP and STL export; STEP reimport checks.
- [x] Automated geometry, project, drawing-interchange and local HTTP tests (56 passing locally).
- [x] GitHub CI execution on Windows and Linux, plus frontend tests/build.

## Milestone 2 — local interactive experiment

- [x] Real 3D visualization generated from the CAD model.
- [x] Editable dimensions and clear errors while preserving the last valid model.
- [x] Project download/reopen and model exports.
- [x] Keyboard controls, labels, and a narrow-screen layout (390 px checked).
- [x] Local operation without accounts, analytics, or cloud geometry processing.

Initial UI checks: 80 → 100 mm rebuild, invalid-width rejection with the previous
model retained, undo/redo, STEP download, project save/reopen, and no horizontal
overflow at a 390 px browser viewport. Two automated history tests also pass.

## Later — full CAD application

Interactive constrained sketching, a general feature history, stable topology
references across changes, additional part operations, assemblies, technical drawings,
broader format support, and extensions. These need their own design and validation.

## Evidence before claims

- Compare real tasks with FreeCAD; compare commercial products only when legitimately available.
- Test models in a separate CAD program, beyond our own export/reimport.
- Observe real CAD users before claiming an easier workflow.
- Do not promise lossless DWG support until a verified interoperability solution exists.
