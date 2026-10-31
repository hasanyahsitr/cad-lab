import math

import pytest
from build123d import GeomType, import_stl

from cad_lab.geometry import build_plate, export_part, mesh_data, reimport_step, validate_part
from cad_lab.project import PlateParameters


@pytest.mark.parametrize(
    "parameters",
    [
        PlateParameters(),
        PlateParameters(width=100),
        PlateParameters(width=120, depth=70, thickness=8, hole_diameter=8, margin=15),
    ],
)
def test_exact_geometry_and_hole_placement(parameters):
    part = build_plate(parameters)
    assert part.is_valid
    assert len(part.solids()) == 1
    assert part.volume == pytest.approx(parameters.expected_volume, rel=1e-6)
    holes = part.faces().filter_by(GeomType.CYLINDER)
    assert len(holes) == 4
    # Face.center() defaults to a parametric surface point, not the cylinder axis.
    positions = sorted(
        (round(f.bounding_box().center().X, 5), round(f.bounding_box().center().Y, 5))
        for f in holes
    )
    assert positions == sorted(parameters.centers)
    for face in holes:
        assert face.radius == pytest.approx(parameters.hole_diameter / 2)
        assert face.bounding_box().size.Z == pytest.approx(parameters.thickness)


def test_step_round_trip_preserves_exact_solid(tmp_path):
    parameters = PlateParameters(width=100)
    part = build_plate(parameters)
    path = tmp_path / "plate.step"
    export_part(part, path, "step")
    assert path.read_text().startswith("ISO-10303-21;")
    imported = reimport_step(path)
    validate_part(imported, parameters)
    assert imported.volume == pytest.approx(part.volume, rel=1e-6)


def test_stl_export_contains_a_mesh(tmp_path):
    path = tmp_path / "plate.stl"
    export_part(build_plate(PlateParameters()), path, "stl")
    assert path.stat().st_size > 84
    assert len(import_stl(path).faces()) > 0


def test_viewport_mesh_comes_from_cad_geometry():
    mesh = mesh_data(build_plate(PlateParameters()))
    assert mesh["valid"]
    assert mesh["solid_count"] == 1
    assert len(mesh["triangles"]) > 12
    assert all(math.isfinite(c) for vertex in mesh["vertices"] for c in vertex)
    assert all(0 <= i < len(mesh["vertices"]) for tri in mesh["triangles"] for i in tri)
