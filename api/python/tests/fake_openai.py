#!/usr/bin/env python3
"""Fake OpenAI Responses endpoint for the runner tests (stdlib only).

Serves `POST /v1/responses` as a server-sent event stream, the way the OpenAI
Agents SDK consumes it. The reply is scripted by the request itself:

- last input item is a `function_call_output`  -> text `tool said: <output>`
- last user message is `call:<tool>:<json>`    -> a function call to <tool>
- last user message is `hang`                  -> headers, then nothing
- anything else                                -> the TOKENS below, one delta each

`GET /_requests` returns every request body received so far.

Used in-process by pytest (`start()`), and as a subprocess by the Jest
integration test: `python fake_openai.py` prints `{"port": N}` then serves.
"""
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKENS = ["Hello", " from", " the", " fake", " model"]


def _last_item(body: dict):
    items = body.get("input")
    if isinstance(items, str):
        return {"role": "user", "content": items}
    return items[-1] if items else {}


def _text_of(item: dict) -> str:
    content = item.get("content", "")
    if isinstance(content, str):
        return content
    return "".join(part.get("text", "") for part in content if isinstance(part, dict))


def _response(resp_id: str, model: str, output: list, status: str = "completed") -> dict:
    return {
        "id": resp_id,
        "object": "response",
        "created_at": int(time.time()),
        "status": status,
        "model": model,
        "output": output,
        "parallel_tool_calls": True,
        "tool_choice": "auto",
        "tools": [],
        "usage": {
            "input_tokens": 7,
            "input_tokens_details": {"cached_tokens": 0},
            "output_tokens": len(TOKENS),
            "output_tokens_details": {"reasoning_tokens": 0},
            "total_tokens": 7 + len(TOKENS),
        },
    }


def _script(body: dict, n: int) -> list[dict]:
    """The list of SSE events answering one request."""
    model = body.get("model", "fake-model")
    resp_id = f"resp_{n}"
    last = _last_item(body)
    events = [{"type": "response.created", "response": _response(resp_id, model, [], "in_progress")}]

    text = _text_of(last) if last.get("role") == "user" else ""
    if last.get("type") != "function_call_output" and text.startswith("call:"):
        _, name, arguments = text.split(":", 2)
        item = {
            "type": "function_call",
            "id": f"fc_{n}",
            "call_id": f"call_{n}",
            "name": name,
            "arguments": arguments,
            "status": "completed",
        }
        events.append({"type": "response.output_item.done", "output_index": 0, "item": item})
        events.append({"type": "response.completed", "response": _response(resp_id, model, [item])})
        return events

    if last.get("type") == "function_call_output":
        tokens = ["tool said: ", str(last.get("output", ""))]
    else:
        tokens = TOKENS
    item_id = f"msg_{n}"
    for token in tokens:
        events.append({
            "type": "response.output_text.delta",
            "item_id": item_id,
            "output_index": 0,
            "content_index": 0,
            "delta": token,
            "logprobs": [],
        })
    message = {
        "type": "message",
        "id": item_id,
        "role": "assistant",
        "status": "completed",
        "content": [{"type": "output_text", "text": "".join(tokens), "annotations": []}],
    }
    events.append({"type": "response.output_item.done", "output_index": 0, "item": message})
    events.append({"type": "response.completed", "response": _response(resp_id, model, [message])})
    return events


class _Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):  # keep stdout/stderr quiet
        pass

    def _json(self, status: int, payload) -> None:
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/_requests":
            return self._json(200, self.server.requests)
        self._json(404, {"error": "not found"})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")
        if not self.path.endswith("/responses"):
            return self._json(404, {"error": {"message": f"no route {self.path}"}})
        self.server.requests.append(body)
        n = len(self.server.requests)

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        if _text_of(_last_item(body)) == "hang":
            self.wfile.flush()
            self.server.stopped.wait()
            return
        for seq, event in enumerate(_script(body, n)):
            event["sequence_number"] = seq
            self.wfile.write(f"event: {event['type']}\ndata: {json.dumps(event)}\n\n".encode())
            self.wfile.flush()


def start(port: int = 0) -> ThreadingHTTPServer:
    """Start the fake endpoint on a daemon thread; `server.server_port` is the port."""
    server = ThreadingHTTPServer(("127.0.0.1", port), _Handler)
    server.daemon_threads = True
    server.requests = []
    server.stopped = threading.Event()
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def stop(server: ThreadingHTTPServer) -> None:
    server.stopped.set()
    server.shutdown()
    server.server_close()


if __name__ == "__main__":
    srv = start(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
    print(json.dumps({"port": srv.server_port}), flush=True)
    try:
        # Exit with the parent: stdin closes when the test process goes away.
        sys.stdin.read()
    finally:
        stop(srv)
