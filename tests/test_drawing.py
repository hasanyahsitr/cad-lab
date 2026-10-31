import io
import json
from pathlib import Path

import ezdxf
import pytest

from cad_lab.drawing import drawing_from_dxf, drawing_to_dxf
from cad_lab.project import ProjectError


def sample():
    return {
        "format": "cad-lab.drawing",
        "schema_version": 1,
        "units": "mm",
        "name": "Drawing",
        "layers": [{"id": "0", "name": "0", "color": "#85c7ef", "visible": True, "locked": True}],
        "entities": [
            {"id": "a", "layer": "0", "type": "line", "points": [[0, 0], [100, 50]]},
            {"id": "b", "layer": "0", "type": "circle", "center": [10, 10], "radius": 2.5},
            {
                "id": "c",
                "layer": "0",
                "type": "polyline",
                "points": [[0, 0], [80, 0], [80, 50], [0, 50]],
                "closed": True,
            },
        ],
    }


def test_dxf_contains_exact_entities_units_and_layer_properties():
    output = drawing_to_dxf(json.dumps(sample()))
    document = ezdxf.read(io.StringIO(output.decode("utf-8")))
    assert document.units == ezdxf.units.MM
    model = document.modelspace()
    assert [e.dxftype() for e in model] == ["LINE", "CIRCLE", "LWPOLYLINE"]
    assert tuple(model[0].dxf.end) == (100, 50, 0)
    assert model[1].dxf.radius == 2.5
    assert model[2].closed
    assert document.layers.get("0").is_locked()
    assert document.layers.get("0").rgb == (133, 199, 239)
    assert not document.audit().has_errors


def test_office_example_round_trips_every_entity_and_layer_state():
    source = Path(__file__).resolve().parents[1] / "examples/office-layout.cadlab.json"
    original = json.loads(source.read_text(encoding="utf-8"))
    encoded = drawing_to_dxf(json.dumps(original)).decode("utf-8")
    imported = drawing_from_dxf(encoded)["drawing"]
    assert len(imported["entities"]) == len(original["entities"])
    for before, after in zip(original["entities"], imported["entities"], strict=True):
        for key in ("type", "points", "closed", "center", "radius"):
            assert before.get(key) == after.get(key)
    by_name = {layer["name"]: layer for layer in imported["layers"]}
    for layer in original["layers"]:
        for key in ("color", "visible", "locked"):
            assert layer[key] == by_name[layer["name"]][key]


@pytest.mark.parametrize(
    "mutation",
    [
        lambda d: d.update(units="inch"),
        lambda d: d["entities"][0].update(layer="missing"),
        lambda d: d["entities"][1].update(radius=-1),
        lambda d: d["layers"][0].update(name="bad/name"),
        lambda d: d["entities"][0].update(points=[[0, 0], [float("inf"), 0]]),
        lambda d: d["entities"][0].update(type="unsupported"),
        lambda d: d["entities"][0].update(type=[]),
        lambda d: d["entities"][0].update(layer=[]),
    ],
)
def test_invalid_drawing_export_is_rejected(mutation):
    data = sample()
    mutation(data)
    with pytest.raises(ProjectError):
        drawing_to_dxf(json.dumps(data))


def test_supported_dxf_round_trip_preserves_geometry_and_layer_state():
    encoded = drawing_to_dxf(json.dumps(sample())).decode("utf-8")
    result = drawing_from_dxf(encoded)
    assert result["report"]["entities"] == 3
    assert result["drawing"]["layers"][0]["locked"]
    original = sample()["entities"]
    imported = result["drawing"]["entities"]
    for first, second in zip(original, imported, strict=True):
        for key, value in first.items():
            if key != "id":
                assert second[key] == value


def test_windows_crlf_input_preserves_header_units_and_geometry():
    content = drawing_to_dxf(json.dumps(sample())).decode("utf-8").replace("\n", "\r\n")
    result = drawing_from_dxf(content)
    assert result["report"]["units"] == "mm"
    assert result["report"]["entities"] == 3


@pytest.mark.parametrize("kind", ["TEXT", "POLYLINE_BULGE", "UNIT_INCH", "Z_LINE", "PAPERSPACE"])
def test_unsupported_dxf_is_rejected_instead_of_silently_dropping_geometry(kind):
    document = ezdxf.new("R2010", units=ezdxf.units.MM)
    model = document.modelspace()
    if kind == "TEXT":
        model.add_text("Do not silently lose me")
    elif kind == "POLYLINE_BULGE":
        model.add_lwpolyline([(0, 0, 0, 0, 1), (10, 0, 0, 0, 0)])
    elif kind == "UNIT_INCH":
        document.units = ezdxf.units.IN
    elif kind == "Z_LINE":
        model.add_line((0, 0, 5), (10, 10, 5))
    else:
        document.layout().add_line((0, 0), (10, 10))
    output = io.StringIO()
    document.write(output)
    with pytest.raises(ProjectError):
        drawing_from_dxf(output.getvalue())
