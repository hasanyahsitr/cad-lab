"""Loopback-only, stateless bridge between the local UI and the CAD kernel."""

import argparse
import json
import mimetypes
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from cad_lab.geometry import build_plate, export_part, mesh_data
from cad_lab.project import MAX_PROJECT_BYTES, Project, ProjectError


class LocalCADServer(ThreadingHTTPServer):
    def __init__(self, address, web_root):
        self.web_root = Path(web_root).resolve()
        self.geometry_lock = threading.Lock()
        super().__init__(address, CADHandler)

    @property
    def allowed_hosts(self):
        return {f"127.0.0.1:{self.server_port}", f"localhost:{self.server_port}"}


class CADHandler(BaseHTTPRequestHandler):
    server_version = "CADLab"

    def log_message(self, *_args):
        pass

    def _send(self, status, payload, content_type="application/json; charset=utf-8", filename=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header(
            "Content-Security-Policy",
            (
                "default-src 'self'; script-src 'self'; style-src 'self'; "
                "connect-src 'self'; img-src 'self' data: blob:; "
                "object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
            ),
        )
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def _json(self, status, data):
        self._send(status, json.dumps(data, allow_nan=False).encode("utf-8"))

    def _local_request(self):
        host = self.headers.get("Host", "")
        if host not in self.server.allowed_hosts:
            self._json(403, {"error": "Only loopback hosts are allowed."})
            return False
        origin = self.headers.get("Origin")
        if origin is not None and origin not in {
            f"http://{host}" for host in self.server.allowed_hosts
        }:
            self._json(403, {"error": "Cross-origin requests are not allowed."})
            return False
        return True

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self._local_request():
            return
        route = urlsplit(self.path).path
        if route == "/api/project":
            self._json(200, Project().to_dict())
            return
        if route.startswith("/api/"):
            self._json(404, {"error": "Unknown endpoint."})
            return
        try:
            relative = unquote(route).lstrip("/") or "index.html"
            path = (self.server.web_root / relative).resolve()
            if not path.is_relative_to(self.server.web_root) or not path.is_file():
                self._json(404, {"error": "Not found. Build the web application first."})
                return
            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            if path.suffix == ".js":
                content_type = "text/javascript"
            self._send(200, path.read_bytes(), content_type)
        except (OSError, ValueError):
            self._json(404, {"error": "Not found."})

    def do_POST(self):
        if not self._local_request():
            return
        route = urlsplit(self.path).path
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json(400, {"error": "Invalid content length."})
            return
        if size <= 0:
            self._json(413, {"error": "Send a project no larger than 64 KiB."})
            return
        try:
            self.connection.settimeout(10)
            # Consume bounded bodies before rejecting them; closing a socket with unread
            # data can discard the error response on Windows. Never read an unbounded body.
            raw = self.rfile.read(min(size, MAX_PROJECT_BYTES + 1))
            if size > MAX_PROJECT_BYTES:
                self._json(413, {"error": "Send a project no larger than 64 KiB."})
                return
            if route not in {"/api/model", "/api/export/step", "/api/export/stl"}:
                self._json(404, {"error": "Unknown endpoint."})
                return
            if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                self._json(415, {"error": "Send an application/json project."})
                return
            project = Project.from_json(raw.decode("utf-8"))
            # Serve browser assets concurrently while serializing all OCCT operations.
            with self.server.geometry_lock:
                part = build_plate(project.parameters)
                if route == "/api/model":
                    result = {"project": project.to_dict(), "mesh": mesh_data(part)}
                else:
                    file_format = route.rsplit("/", 1)[1]
                    with tempfile.TemporaryDirectory(prefix="cadlab-") as directory:
                        path = Path(directory) / f"plate.{file_format}"
                        export_part(part, path, file_format)
                        payload = path.read_bytes()
            if route == "/api/model":
                self._json(200, result)
                return
            self._send(200, payload, "application/octet-stream", f"plate.{file_format}")
        except (ProjectError, UnicodeError) as exc:
            self._json(422, {"error": str(exc)})
        except (TimeoutError, OSError):
            self._json(400, {"error": "Could not read this request or produce the export."})
        except Exception:
            self._json(
                500, {"error": "The geometry operation failed. The last valid model is kept."}
            )


def main():
    parser = argparse.ArgumentParser(description="Serve the CAD Lab local experiment")
    parser.add_argument("--port", type=int, default=4310)
    parser.add_argument("--web-root", type=Path, default=Path("web/dist"))
    args = parser.parse_args()
    if not (args.web_root / "index.html").is_file():
        parser.error("Build the frontend first: npm --prefix web ci && npm --prefix web run build")
    with LocalCADServer(("127.0.0.1", args.port), args.web_root) as server:
        print(f"CAD Lab: http://127.0.0.1:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
