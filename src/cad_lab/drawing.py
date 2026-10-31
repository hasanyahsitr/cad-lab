"""Validated 2D drawing interchange for an explicitly supported DXF subset."""

import io
import json
import math
import re

import ezdxf

from cad_lab.project import ProjectError

MAX_DRAWING_BYTES = 1024 * 1024


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
