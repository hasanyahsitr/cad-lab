"""Exact BREP generation using build123d and the upstream Open CASCADE kernel."""

import math
from pathlib import Path

from build123d import Align, Box, Cylinder, Pos, export_step, export_stl, import_step

from cad_lab.project import PlateParameters, ProjectError


def build_plate(parameters: PlateParameters):
    if not isinstance(parameters, PlateParameters):
        raise ProjectError("Validated plate parameters are required.")
    part = Box(
        parameters.width,
        parameters.depth,
        parameters.thickness,
        align=(Align.MIN, Align.MIN, Align.MIN),
    )
    for x, y in parameters.centers:
        part -= Pos(x, y, 0) * Cylinder(
            parameters.hole_diameter / 2,
            parameters.thickness,
            align=(Align.CENTER, Align.CENTER, Align.MIN),
        )
    validate_part(part, parameters)
    return part


def validate_part(part, parameters):
    if not part.is_valid or len(part.solids()) != 1:
        raise ProjectError("Geometry did not produce one valid solid.")
    if not math.isclose(part.volume, parameters.expected_volume, rel_tol=1e-6):
        raise ProjectError("Geometry volume does not match the requested dimensions.")
    box = part.bounding_box().size
    for actual, expected in zip(
        (box.X, box.Y, box.Z),
        (parameters.width, parameters.depth, parameters.thickness),
        strict=True,
    ):
        if not math.isclose(actual, expected, rel_tol=1e-6, abs_tol=1e-6):
            raise ProjectError("Geometry bounds do not match the requested dimensions.")


def export_part(part, path: Path, file_format: str):
    if file_format == "step":
        success = export_step(part, path)
    elif file_format == "stl":
        success = export_stl(part, path, tolerance=0.05, angular_tolerance=0.1)
    else:
        raise ProjectError("Supported exports: STEP and STL.")
    if not success:
        raise ProjectError("The CAD kernel could not export this model.")


def reimport_step(path: Path):
    return import_step(path)


def mesh_data(part):
    vertices, triangles = part.tessellate(0.1, 0.1)
    return {
        "vertices": [[v.X, v.Y, v.Z] for v in vertices],
        "triangles": [list(triangle) for triangle in triangles],
        "volume": part.volume,
        "solid_count": len(part.solids()),
        "valid": part.is_valid,
    }
