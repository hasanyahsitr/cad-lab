"""Strict, versioned project data. Projects contain data, never executable code."""

import json
import math
from dataclasses import asdict, dataclass, fields

FORMAT = "cad-lab.project"
MAX_PROJECT_BYTES = 64 * 1024


class ProjectError(ValueError):
    """Invalid or unsupported project data."""


@dataclass(frozen=True)
class PlateParameters:
    width: float = 80.0
    depth: float = 50.0
    thickness: float = 6.0
    hole_diameter: float = 5.0
    margin: float = 10.0

    def __post_init__(self):
        for field in fields(self):
            value = getattr(self, field.name)
            if type(value) not in (int, float):
                raise ProjectError(f"{field.name}: enter a finite number in millimeters.")
            if not 0.1 <= value <= 2000 or not math.isfinite(value):
                raise ProjectError(f"{field.name}: must be between 0.1 and 2000 mm.")
        radius = self.hole_diameter / 2
        if self.margin <= radius:
            raise ProjectError("Hole centers must be farther from the edge than the hole radius.")
        if self.width - 2 * self.margin <= self.hole_diameter:
            raise ProjectError("Width is too small: holes would overlap or touch.")
        if self.depth - 2 * self.margin <= self.hole_diameter:
            raise ProjectError("Depth is too small: holes would overlap or touch.")

    @property
    def centers(self):
        return tuple(
            (x, y)
            for x in (self.margin, self.width - self.margin)
            for y in (self.margin, self.depth - self.margin)
        )

    @property
    def expected_volume(self):
        return (
            self.width * self.depth - 4 * math.pi * (self.hole_diameter / 2) ** 2
        ) * self.thickness


@dataclass(frozen=True)
class Project:
    parameters: PlateParameters = PlateParameters()
    name: str = "Mounting plate"

    def __post_init__(self):
        if not isinstance(self.parameters, PlateParameters):
            raise ProjectError("parameters must be validated plate parameters.")
        if (
            not isinstance(self.name, str)
            or not self.name.strip()
            or len(self.name) > 80
            or any(ord(char) < 32 for char in self.name)
        ):
            raise ProjectError("Project name must contain 1–80 printable characters.")

    def to_dict(self):
        return {
            "format": FORMAT,
            "schema_version": 1,
            "units": "mm",
            "name": self.name,
            "model": {"type": "four-hole-plate", "parameters": asdict(self.parameters)},
        }

    def to_json(self):
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2, allow_nan=False) + "\n"

    @classmethod
    def from_dict(cls, data):
        required = {"format", "schema_version", "units", "name", "model"}
        if not isinstance(data, dict) or set(data) != required:
            raise ProjectError("Project fields are missing or unsupported.")
        if data["format"] != FORMAT:
            raise ProjectError("This is not a CAD Lab project.")
        if type(data["schema_version"]) is not int or data["schema_version"] != 1:
            raise ProjectError("Unsupported project version.")
        if data["units"] != "mm":
            raise ProjectError("This version supports millimeters only.")
        model = data["model"]
        if not isinstance(model, dict) or set(model) != {"type", "parameters"}:
            raise ProjectError("Invalid model definition.")
        if model["type"] != "four-hole-plate":
            raise ProjectError("Unsupported model type.")
        params = model["parameters"]
        if not isinstance(params, dict) or set(params) != {f.name for f in fields(PlateParameters)}:
            raise ProjectError("Plate parameters are missing or unsupported.")
        return cls(PlateParameters(**params), data["name"])

    @classmethod
    def from_json(cls, content):
        if len(content.encode("utf-8")) > MAX_PROJECT_BYTES:
            raise ProjectError("Project exceeds the 64 KiB limit.")
        try:
            data = json.loads(content, object_pairs_hook=_unique_object)
        except ProjectError:
            raise
        except (ValueError, RecursionError) as exc:
            raise ProjectError("Project is not valid JSON.") from exc
        return cls.from_dict(data)


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ProjectError(f"Duplicate project field: {key}.")
        result[key] = value
    return result
