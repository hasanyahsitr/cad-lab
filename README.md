# CAD Lab

An independent, open-source CAD project started by Hasan Yahşi. **CAD Lab is a working name.**

Long-term direction: approachable, precise, local-first CAD with editable models,
assemblies, technical drawings, and interoperable files, including commercial use
without a mandatory subscription.

This repository starts with a deliberately small engineering milestone: a
dimension-driven plate with four through-holes, project save/reopen, and STEP export.
It is not yet a general-purpose sketcher or an AutoCAD/Fusion replacement.

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

Implemented: real CAD-derived 3D viewport, editable plate dimensions, bounded
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

Known limits: only the four-hole plate is implemented; no interactive sketch solver,
arbitrary feature tree, assemblies, technical drawing, DWG support, or packaged desktop
installer. STEP round trips use the same upstream kernel; an independent CAD-program
validation and real-user workflow comparison are still required.

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
