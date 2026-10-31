"""Small reproducible command-line entry point for the first CAD milestone."""

import argparse
import json
import sys
from pathlib import Path

from cad_lab.geometry import build_plate, export_part, reimport_step, validate_part
from cad_lab.project import MAX_PROJECT_BYTES, PlateParameters, Project, ProjectError


def main():
    parser = argparse.ArgumentParser(description="CAD Lab: exact local CAD geometry experiment")
    parser.add_argument("--project", type=Path, help="Open a versioned .cadlab.json project")
    parser.add_argument("--width", type=float, help="Override width in mm")
    parser.add_argument("--out", type=Path, default=Path("artifacts"))
    args = parser.parse_args()
    try:
        if args.project:
            if args.project.stat().st_size > MAX_PROJECT_BYTES:
                raise ProjectError("Project exceeds the 64 KiB limit.")
            project = Project.from_json(args.project.read_text(encoding="utf-8"))
        else:
            project = Project()
        if args.width is not None:
            values = project.to_dict()["model"]["parameters"]
            values["width"] = args.width
            project = Project(PlateParameters(**values), project.name)
        part = build_plate(project.parameters)
        args.out.mkdir(parents=True, exist_ok=True)
        project_path = args.out / "plate.cadlab.json"
        step_path = args.out / "plate.step"
        stl_path = args.out / "plate.stl"
        export_part(part, step_path, "step")
        export_part(part, stl_path, "stl")
        validate_part(reimport_step(step_path), project.parameters)
        project_path.write_text(project.to_json(), encoding="utf-8")
        print(
            json.dumps(
                {
                    "name": project.name,
                    "valid": part.is_valid,
                    "solids": len(part.solids()),
                    "volume_mm3": round(part.volume, 6),
                    "step_round_trip": "passed",
                    "files": [str(project_path), str(step_path), str(stl_path)],
                },
                indent=2,
            )
        )
    except (ProjectError, OSError, UnicodeError) as exc:
        print(f"CAD Lab: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
