import json
import math

import pytest

from cad_lab.project import PlateParameters, Project, ProjectError


def test_editable_project_round_trip():
    original = Project(PlateParameters(width=100), "Bağlantı plakası")
    assert Project.from_json(original.to_json()) == original
    assert original.parameters.centers == ((10, 10), (10, 40), (90, 10), (90, 40))


@pytest.mark.parametrize("value", [True, "80", None, math.nan, math.inf, -1, 0, 2001, 10**500])
def test_reject_invalid_numbers(value):
    with pytest.raises(ProjectError):
        PlateParameters(width=value)


@pytest.mark.parametrize(
    "values",
    [
        {"margin": 2.5},
        {"margin": 2},
        {"width": 25},
        {"depth": 25},
        {"hole_diameter": 21},
    ],
)
def test_reject_holes_touching_or_outside_plate(values):
    with pytest.raises(ProjectError):
        PlateParameters(**values)


@pytest.mark.parametrize(
    "field,value",
    [
        ("schema_version", 2),
        ("schema_version", True),
        ("units", "inch"),
        ("name", ""),
        ("name", "x\n"),
        ("format", "other-format"),
    ],
)
def test_reject_unsupported_project_data(field, value):
    data = Project().to_dict()
    data[field] = value
    with pytest.raises(ProjectError):
        Project.from_dict(data)


def test_reject_unknown_parameters_instead_of_silently_dropping_them():
    data = Project().to_dict()
    data["model"]["parameters"]["script"] = "not executable"
    with pytest.raises(ProjectError):
        Project.from_dict(data)


@pytest.mark.parametrize(
    "content",
    [
        '{"format":"one","format":"two"}',
        "[1,2,3]",
        "{",
        " " * 65537,
    ],
)
def test_reject_malformed_or_oversized_projects(content):
    with pytest.raises(ProjectError):
        Project.from_json(content)


def test_nonfinite_json_is_not_accepted():
    data = Project().to_dict()
    data["model"]["parameters"]["width"] = math.nan
    with pytest.raises(ProjectError):
        Project.from_json(json.dumps(data))
