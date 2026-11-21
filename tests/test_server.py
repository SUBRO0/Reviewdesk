import io
import json
import unittest
from unittest.mock import MagicMock, patch
from types import SimpleNamespace

import server


class InMemoryConnection:
    """Exercise real HTTP request parsing without opening a network listener."""
    def __init__(self, message):
        self.reader = io.BytesIO(message)
        self.response = bytearray()

    def makefile(self, *_):
        return self.reader

    def sendall(self, chunk):
        self.response.extend(chunk)


def request(path, payload=None, host="localhost:8000"):
    method = "GET" if payload is None else "POST"
    body = b"" if payload is None else json.dumps(payload).encode()
    raw = (f"{method} {path} HTTP/1.0\r\nHost: {host}\r\nContent-Type: application/json\r\n"
           f"Content-Length: {len(body)}\r\n\r\n").encode() + body
    connection = InMemoryConnection(raw)
    with patch.object(server.Handler, "log_message"):
        server.Handler(connection, ("127.0.0.1", 5555), SimpleNamespace(server_port=8000))
    headers, content = bytes(connection.response).split(b"\r\n\r\n", 1)
    return int(headers.split()[1]), content


class ReviewTests(unittest.TestCase):
    def test_app_and_configuration(self):
        for path in ("/", "/app.mjs", "/engine.mjs", "/style.css", "/mark.svg"):
            self.assertEqual(request(path)[0], 200)
        self.assertTrue(json.loads(request("/api/config")[1])["ollama"])

    def test_rejects_empty_external_and_oversized_requests(self):
        self.assertEqual(request("/api/review", {})[0], 400)
        self.assertEqual(request("/api/review", {}, "outside.example")[0], 403)
        self.assertEqual(request("/api/review", {"language": "Python", "code": "x"*12001})[0], 413)

    def test_valid_provider_response(self):
        finding = dict(line=1, severity="medium", category="Correctness", title="Check result",
                       detail="The return value is discarded.", fix="Use the computed value.")
        reply = {"message": {"content": json.dumps({"findings": [finding]})}}
        client = MagicMock()
        client.open.return_value.__enter__.return_value.read.return_value = json.dumps(reply).encode()
        with patch.object(server, "build_opener", return_value=client):
            status, data = request("/api/review", {"language": "Python", "code": "calculate_total()"})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data)["findings"][0], dict(finding, source="Ollama"))
        sent = json.loads(client.open.call_args.args[0].data)
        self.assertIn("1 | calculate_total()", sent["messages"][-1]["content"])

    def test_out_of_range_provider_line(self):
        with self.assertRaises(ValueError):
            server.validate_findings({"findings": [{"line": 99}]}, 1)

    def test_unavailable_provider_is_an_error(self):
        with patch.object(server, "model_review", side_effect=RuntimeError("Ollama is unavailable.")):
            status, data = request("/api/review", {"language": "Python", "code": "print(1)"})
        self.assertEqual(status, 502)
        self.assertIn("unavailable", json.loads(data)["error"])
