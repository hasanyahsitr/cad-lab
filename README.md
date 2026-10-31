# CAD Lab

An independent, open-source CAD project started by Hasan Yahşi. **CAD Lab is a working name.**

Long-term direction: a comprehensive, independent AutoCAD-class drawing application,
with precise local editing, technical drawings, interoperable files, and integrated
3D modeling, including commercial use without a mandatory subscription.

Implemented now: a drawing-first 2D workbench with command input, editable entities,
selection, layers, snapping, undo/redo and DXF export. The original dimension-driven
3D plate is retained as a separate engineering experiment. This is an early CAD core,
not a complete AutoCAD replacement.

## 2D drafting workbench

The default page at **http://127.0.0.1:4310/** opens the drawing application. Supported
commands: `LINE` (`L`), `PLINE` (`PL`), `RECTANG` (`REC`), `CIRCLE` (`C`), `MOVE` (`M`),
`COPY` (`CO`), `ERASE` (`E`), `DIST` (`DI`), `UNDO` (`U`), `REDO`, `LAYER` and zoom extents.

Try `REC 0,0 100,60`, then `C 20,20 5`. Click an entity and enter `M 0,0 10,0`.
Coordinates use `.` for decimals and `,` between X/Y. Relative coordinates use
`@20,0`; polar coordinates use `@50<90`. LINE/PLINE continue until Enter/Esc, `C`
closes them, and command-local `U` removes the last pending point. CIRCLE accepts
`D` for diameter. Shift-click toggles multi-selection; middle-drag pans; the wheel zooms.
Dragging left-to-right selects completely enclosed objects. Right-to-left crossing
selection tests actual line segments and circle circumferences, not only their bounds.

Layer visibility, locking and color, grid display/snap, orthographic input and
endpoint/midpoint/center/quadrant snapping are implemented. Save/reopen editable JSON
drawings and export LINE/LWPOLYLINE/CIRCLE entities to actual DXF, including layer
colors/visibility/locking and millimeter units. Import ASCII DXF files for this same
planar model-space subset, including Windows CRLF files. Unsupported geometry,
non-mm units, entity style overrides, polyline arcs/widths and paper-space content
are rejected while keeping the current drawing. The import report explains which
metadata is outside the supported subset. DWG support is not implemented.

The 3D plate experiment is at **http://127.0.0.1:4310/index.html**.

The owner requested independent review through Google Antigravity/Gemini 4 Argon High.
See the [incorporated review findings](docs/REVIEW-RESULTS.md) and [product direction](docs/AUTOCAD-DIRECTION.md).

## Run the geometry milestone

Python 3.12 is required. On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
.\.venv\Scripts\python.exe -m pip install --no-deps -e .
.\.venv\Scripts\python.exe -m cad_lab.cli --project examples/plate.cadlab.json
.\.venv\Scripts\python.exe -m cad_lab.cli --project examples/plate.cadlab.json --width 100 --out artifacts/wide
.\.venv\Scripts\python.exe -m pytest -q
```

Linux/macOS use `.venv/bin/python` instead. The CLI writes a versioned editable
project, a STEP solid, and an STL mesh. It reimports STEP and verifies volume,
dimensions, and validity. Generated outputs and virtual environments are gitignored.
The lock file records the dependencies used in the first tested environment.

## Run the local workbench

Install the Python environment above and Node.js 24, then:

```powershell
npm --prefix web ci
npm --prefix web run build
.\.venv\Scripts\python.exe -m cad_lab.server
```

Open **http://127.0.0.1:4310**. The first UI is in Turkish. The server binds only
to loopback and serves the built frontend, never the source tree or your disk.
It is a local development tool, not an internet-facing multi-user service.

The separate 3D experiment implements a real CAD-derived viewport, editable plate dimensions, bounded
undo/redo history, project download/reopen, STEP/STL download, and preservation of
the last valid model after invalid input. Unsaved edits disable downloads until
applied or reverted, so exported files match the displayed model.

Keyboard: focus the viewport, use arrow keys to orbit, `+`/`-` to zoom, and `F` to fit.
Model computation is local. No account, analytics, remote geometry service, external
fonts, or CDN is required. Dependency installation needs network access once.

Additional checks:

```powershell
npm --prefix web test
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
```

Known limits: no interactive constraint solver, arbitrary 3D feature tree, assemblies,
dimensions/layouts/plotting, DWG, or packaged desktop installer. The 2D
workbench implements a limited entity and command subset. STEP/DXF round trips use
their respective upstream libraries; independent CAD-program validation and real-user
workflow comparisons remain required. Snapshot history and SVG rendering are initial
choices, not a claim of production-scale drawing performance.

## Development in public

Small commits record working milestones. The roadmap distinguishes implemented
features from ideas. Issues and pull requests will carry reproducible examples and
validation results. No production hosting is needed to run the local application.

- [Roadmap](docs/ROADMAP.md)
- [Engineering decisions](docs/DECISIONS.md)
- [Third-party foundations](THIRD_PARTY.md)
- [Türkçe](README.tr.md)

## License

Our original code is MIT-licensed. Dependencies retain their own licenses;
in particular, Open CASCADE is LGPL-2.1 with an additional exception.
