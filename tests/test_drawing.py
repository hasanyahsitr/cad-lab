import io
import json

import ezdxf
import pytest

from cad_lab.drawing import drawing_to_dxf
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


@pytest.mark.parametrize(
    "mutation",
    [
        lambda d: d.update(units="inch"),
        lambda d: d["entities"][0].update(layer="missing"),
        lambda d: d["entities"][1].update(radius=-1),
        lambda d: d["layers"][0].update(name="bad/name"),
        lambda d: d["entities"][0].update(points=[[0, 0], [float("inf"), 0]]),
        lambda d: d["entities"][0].update(type="unsupported"),
    ],
)
def test_invalid_drawing_export_is_rejected(mutation):
    data = sample()
    mutation(data)
    with pytest.raises(ProjectError):
        drawing_to_dxf(json.dumps(data))
