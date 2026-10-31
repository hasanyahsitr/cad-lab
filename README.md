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
