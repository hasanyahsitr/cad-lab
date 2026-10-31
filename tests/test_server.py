import http.client
import json
import threading

import pytest

from cad_lab.project import Project
from cad_lab.server import LocalCADServer


@pytest.fixture
def local_server(tmp_path):
    root = tmp_path / "web"
    root.mkdir()
    (root / "index.html").write_text("<h1>CAD</h1>", encoding="utf-8")
    (tmp_path / "private.txt").write_text("not public", encoding="utf-8")
    server = LocalCADServer(("127.0.0.1", 0), root)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)


def request(server, method, path, body=None, headers=None):
    connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=30)
    connection.request(method, path, body=body, headers=headers or {})
    response = connection.getresponse()
    result = response.status, dict(response.getheaders()), response.read()
    connection.close()
    return result


def test_serve_only_web_root_and_protect_origin(local_server):
    status, headers, body = request(local_server, "GET", "/")
    assert status == 200
    assert body == b"<h1>CAD</h1>"
    assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]
    assert request(local_server, "GET", "/../private.txt")[0] == 404
    assert request(local_server, "GET", "/%2e%2e/private.txt")[0] == 404
    assert request(local_server, "GET", "/api/project", headers={"Host": "evil.test"})[0] == 403
    assert (
        request(local_server, "GET", "/api/project", headers={"Origin": "https://evil.test"})[0]
        == 403
    )


def test_invalid_request_does_not_corrupt_next_model(local_server):
    data = Project().to_dict()
    data["model"]["parameters"]["width"] = 20
    headers = {"Content-Type": "application/json"}
    status, _, body = request(local_server, "POST", "/api/model", json.dumps(data), headers)
    assert status == 422
    assert "Width" in json.loads(body)["error"]
    status, _, body = request(local_server, "POST", "/api/model", Project().to_json(), headers)
    result = json.loads(body)
    assert status == 200
    assert result["mesh"]["valid"]
    assert result["project"] == Project().to_dict()


def test_step_export_is_a_real_file(local_server):
    status, headers, body = request(
        local_server,
        "POST",
        "/api/export/step",
        Project().to_json(),
        {"Content-Type": "application/json"},
    )
    assert status == 200
    assert body.startswith(b"ISO-10303-21;")
    assert headers["Content-Disposition"] == 'attachment; filename="plate.step"'


def test_reject_wrong_content_and_oversized_project(local_server):
    assert request(local_server, "POST", "/api/model", "{}")[0] == 415
    assert (
        request(
            local_server,
            "POST",
            "/api/model",
            "x" * 65537,
            {"Content-Type": "application/json"},
        )[0]
        == 413
    )
    assert request(local_server, "POST", "/api/admin", "{}")[0] == 404


def test_drawing_export_endpoint_is_separate_from_plate_schema(local_server):
    drawing = {
        "format": "cad-lab.drawing",
        "schema_version": 1,
        "units": "mm",
        "name": "Drawing",
        "layers": [{"id": "0", "name": "0", "color": "#abcdef", "visible": True, "locked": False}],
        "entities": [{"id": "a", "layer": "0", "type": "circle", "center": [20, 20], "radius": 5}],
    }
    status, headers, body = request(
        local_server,
        "POST",
        "/api/drawing/dxf",
        json.dumps(drawing),
        {"Content-Type": "application/json"},
    )
    assert status == 200
    assert headers["Content-Type"] == "application/dxf"
    assert b"CIRCLE" in body
    assert b"AC1024" in body


def test_default_page_prefers_drafting_without_exposing_source_tree(local_server):
    (local_server.web_root / "drafting.html").write_text("<h1>Drafting</h1>", encoding="utf-8")
    assert request(local_server, "GET", "/")[2] == b"<h1>Drafting</h1>"
    assert request(local_server, "GET", "/index.html")[2] == b"<h1>CAD</h1>"
