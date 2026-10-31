# Independent CAD workflow review brief

Public repository: https://github.com/hasanyahsitr/cad-lab

Branch: `codex/first-cad-prototype`

The owner wants a comprehensive open-source AutoCAD-class application. The existing
four-hole-plate model and Turkish 3D UI are only an initial geometry experiment.
The next implementation adds an actual drawing workspace, command state machine,
selection, layers, snaps, editable drawings, and DXF interchange.

Please provide an independent read-only engineering review:

1. Distinguish an AutoCAD-style 2D drafting architecture from a Fusion-style
   parametric-part architecture. Identify which existing modules can be reused.
2. Propose concrete acceptance tests for LINE, PLINE, CIRCLE, RECTANG, MOVE, COPY,
   ERASE, coordinate entry, selection, undo/redo, layer locking, snapping, and DXF.
3. Identify the five highest-risk correctness issues for an initial drafting core.
4. Explain the boundaries between DXF support and verified DWG compatibility.
5. Recommend the next three meaningful implementation milestones, preserving the
   full-product ambition without claiming unimplemented functionality.

Use the public repository and this brief. Return your analysis in the conversation.
Do not modify files, execute terminal commands, commit/push, change settings, access
credentials, or inspect the owner's unrelated websites or documents. Codex is working
on implementation files, so avoid concurrent edits. State assumptions and any sources.
