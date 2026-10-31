# Roadmap

Progress is recorded as implemented work is verified. This is not a release-date promise.

## Milestone 0 — independent foundation

- [x] Separate repository, original-code license, and upstream attribution.
- [x] English and Turkish project introductions.
- [x] Distinguish the product vision from implemented capabilities.

## Milestone 1 — exact geometry and round-trip files

- [ ] Validated plate parameters in millimeters.
- [ ] Four through-holes with edge-relative positions after dimensional changes.
- [ ] Exact solid geometry and analytical volume checks.
- [ ] Versioned project save/load, without executing project-provided code.
- [ ] STEP and STL export; STEP reimport checks.
- [ ] Automated tests and CI.

## Milestone 2 — local interactive experiment

- [ ] Real 3D visualization generated from the CAD model.
- [ ] Editable dimensions and clear errors while preserving the last valid model.
- [ ] Project download/reopen and model exports.
- [ ] Usable keyboard controls, labels, and narrow-screen layout.
- [ ] Local operation without accounts, analytics, or cloud geometry processing.

## Later — full CAD application

Interactive constrained sketching, a general feature history, stable topology
references across changes, additional part operations, assemblies, technical drawings,
broader format support, and extensions. These need their own design and validation.

## Evidence before claims

- Compare real tasks with FreeCAD; compare commercial products only when legitimately available.
- Test models in a separate CAD program, beyond our own export/reimport.
- Observe real CAD users before claiming an easier workflow.
- Do not promise lossless DWG support until a verified interoperability solution exists.
