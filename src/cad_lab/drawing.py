"""Validated 2D drawing interchange for an explicitly supported DXF subset."""

import io
import json
import math
import re
import uuid

import ezdxf

from cad_lab.project import ProjectError

MAX_DRAWING_BYTES = 1024 * 1024


def drawing_from_dxf(content):
    """Import supported planar model-space entities, rejecting unsupported geometry."""
    if not isinstance(content, str) or len(content.encode("utf-8")) > MAX_DRAWING_BYTES:
        raise ProjectError("DXF input exceeds the 1 MiB limit.")
    if not content.strip():
        raise ProjectError("DXF input is empty.")
    try:
        document = ezdxf.read(io.StringIO(content, newline=None))
    except (ezdxf.DXFError, ValueError, IndexError) as exc:
        raise ProjectError("Invalid ASCII DXF input.") from exc
    if document.units != ezdxf.units.MM:
        raise ProjectError("Only DXF files explicitly declaring millimeter units are supported.")
    model = document.modelspace()
    if len(model) > 5000:
        raise ProjectError("At most 5000 entities are supported.")
    unsupported = {entity.dxftype() for entity in model} - {"LINE", "LWPOLYLINE", "CIRCLE"}
    if unsupported:
        raise ProjectError("Unsupported DXF entities: " + ", ".join(sorted(unsupported)))
    if any(len(layout) for layout in document.layouts if layout.name != "Model"):
        raise ProjectError(
            "Paper-space content is not supported; the original file was not changed."
        )
    used_layers = {entity.dxf.layer for entity in model} | {"0"}
    if len(used_layers) > 100:
        raise ProjectError("At most 100 used layers are supported.")
    layers = []
    for name in sorted(used_layers, key=lambda value: (value != "0", value)):
        if name not in document.layers:
            raise ProjectError("An entity references a missing DXF layer.")
        layer = document.layers.get(name)
        if layer.dxf.linetype.upper() != "CONTINUOUS":
            raise ProjectError("Non-continuous layer linetypes are not supported.")
        rgb = layer.rgb or ezdxf.colors.aci2rgb(abs(layer.dxf.color))
        layers.append(
            {
                "id": name,
                "name": name,
                "color": "#" + "".join(f"{v:02x}" for v in rgb),
                "visible": not layer.is_off() and not layer.is_frozen(),
                "locked": layer.is_locked(),
            }
        )
    entities = []
    for entity in model:
        if (
            entity.dxf.get("color", 256) != 256
            or entity.dxf.hasattr("true_color")
            or entity.dxf.get("linetype", "BYLAYER").upper() != "BYLAYER"
            or entity.dxf.get("lineweight", -1) != -1
            or abs(entity.dxf.get("thickness", 0)) > 1e-9
        ):
            raise ProjectError(
                "Per-entity style overrides and extrusion thickness are not supported."
            )
        extrusion = entity.dxf.get("extrusion", (0, 0, 1))
        if any(abs(a - b) > 1e-9 for a, b in zip(extrusion, (0, 0, 1), strict=True)):
            raise ProjectError("Only world-XY planar entities are supported.")
        common = {"id": str(uuid.uuid4()), "layer": entity.dxf.layer}
        kind = entity.dxftype()
        if kind == "LINE":
            start, end = entity.dxf.start, entity.dxf.end
            if abs(start.z) > 1e-9 or abs(end.z) > 1e-9:
                raise ProjectError("3D lines are not supported in the 2D importer.")
            entities.append({**common, "type": "line", "points": [list(start)[:2], list(end)[:2]]})
        elif kind == "CIRCLE":
            if abs(entity.dxf.center.z) > 1e-9:
                raise ProjectError("Only circles in the world-XY plane are supported.")
            entities.append(
                {
                    **common,
                    "type": "circle",
                    "center": list(entity.dxf.center)[:2],
                    "radius": entity.dxf.radius,
                }
            )
        else:
            points = list(entity.get_points("xyseb"))
            if (
                abs(entity.dxf.elevation) > 1e-9
                or abs(entity.dxf.const_width) > 1e-9
                or any(any(abs(v) > 1e-9 for v in p[2:]) for p in points)
            ):
                raise ProjectError("Polyline arcs, widths and elevation are not supported.")
            entities.append(
                {
                    **common,
                    "type": "polyline",
                    "points": [list(p)[:2] for p in points],
                    "closed": entity.closed,
                }
            )
    drawing = {
        "format": "cad-lab.drawing",
        "schema_version": 1,
        "units": "mm",
        "name": "DXF çizimi",
        "layers": layers,
        "entities": entities,
    }
    # Reuse export validation to enforce the same accepted numeric/entity subset.
    drawing_to_dxf(json.dumps(drawing))
    return {
        "drawing": drawing,
        "report": {
            "entities": len(entities),
            "units": "mm",
            "scope": "Model space, planar geometry only",
            "note": (
                "Unused block definitions, extended metadata and layout settings are not imported."
            ),
        },
    }


def _number(value):
    return type(value) in (int, float) and -1e6 <= value <= 1e6 and math.isfinite(value)


def _point(value):
    return isinstance(value, list) and len(value) == 2 and all(_number(v) for v in value)


def drawing_to_dxf(content):
    if len(content.encode("utf-8")) > MAX_DRAWING_BYTES:
        raise ProjectError("Drawing exceeds the 1 MiB limit.")
    try:
        data = json.loads(content)
    except (ValueError, RecursionError) as exc:
        raise ProjectError("Drawing is not valid JSON.") from exc
    if (
        not isinstance(data, dict)
        or data.get("format") != "cad-lab.drawing"
        or type(data.get("schema_version")) is not int
        or data["schema_version"] != 1
        or data.get("units") != "mm"
    ):
        raise ProjectError("Unsupported drawing format, version, or units.")
    layers, entities = data.get("layers"), data.get("entities")
    if not isinstance(layers, list) or not 1 <= len(layers) <= 100:
        raise ProjectError("A drawing requires 1–100 layers.")
    if not isinstance(entities, list) or len(entities) > 5000:
        raise ProjectError("At most 5000 entities are supported.")
    document = ezdxf.new("R2010", units=ezdxf.units.MM)
    names, used_names = {}, set()
    for layer in layers:
        if not isinstance(layer, dict):
            raise ProjectError("Invalid layer.")
        name, identifier = layer.get("name"), layer.get("id")
        if (
            not isinstance(name, str)
            or not name.strip()
            or len(name) > 80
            or re.search(r'[<>/\\":;?*|=\x00-\x1f]', name)
            or not isinstance(identifier, str)
            or not identifier
            or identifier in names
            or name.casefold() in used_names
        ):
            raise ProjectError("Layer names and identifiers must be valid and unique.")
        color = layer.get("color")
        if (
            not isinstance(color, str)
            or not re.fullmatch(r"#[0-9a-fA-F]{6}", color)
            or type(layer.get("visible")) is not bool
            or type(layer.get("locked")) is not bool
        ):
            raise ProjectError("Invalid layer properties.")
        names[identifier] = name
        used_names.add(name.casefold())
        target = document.layers.get("0") if name == "0" else document.layers.new(name)
        target.rgb = tuple(int(color[i : i + 2], 16) for i in (1, 3, 5))
        if not layer["visible"]:
            target.off()
        if layer["locked"]:
            target.lock()
    model = document.modelspace()
    ids = set()
    for entity in entities:
        if not isinstance(entity, dict):
            raise ProjectError("Invalid drawing entity.")
        identifier = entity.get("id")
        if (
            not isinstance(identifier, str)
            or not identifier
            or identifier in ids
            or entity.get("layer") not in names
        ):
            raise ProjectError("Entity identifiers and layers must be valid.")
        ids.add(identifier)
        attributes = {"layer": names[entity["layer"]]}
        kind = entity.get("type")
        if kind == "circle":
            radius = entity.get("radius")
            if not _point(entity.get("center")) or not _number(radius) or radius <= 1e-6:
                raise ProjectError("Invalid circle.")
            model.add_circle(entity["center"], radius, dxfattribs=attributes)
        elif kind in {"line", "polyline"}:
            points = entity.get("points")
            if (
                not isinstance(points, list)
                or not 2 <= len(points) <= 1000
                or not all(_point(point) for point in points)
                or any(math.dist(a, b) < 1e-6 for a, b in zip(points, points[1:], strict=False))
            ):
                raise ProjectError("Invalid line points.")
            if kind == "line":
                if len(points) != 2:
                    raise ProjectError("A line requires two points.")
                model.add_line(*points, dxfattribs=attributes)
            else:
                if type(entity.get("closed")) is not bool:
                    raise ProjectError("Polyline closure must be explicit.")
                if entity["closed"] and len(points) < 3:
                    raise ProjectError("A closed polyline requires at least three points.")
                model.add_lwpolyline(points, close=entity["closed"], dxfattribs=attributes)
        else:
            raise ProjectError("Supported DXF exports: LINE, LWPOLYLINE and CIRCLE.")
    output = io.StringIO()
    document.write(output)
    return output.getvalue().encode("utf-8")
