import json

import pytest
import requests
from agents import Agent, FunctionTool, function_tool

import flow_runner
from flow_runner import build_agent_map, mk_backend_tool

TOOL_DEF = {
    "name": "foo",
    "toolId": "foo-id",
    "description": "desc",
    "parameters": {"type": "object", "properties": {"a": {"type": "integer"}}, "required": ["a"]},
    "toolType": "backend",
}

class DummyResponse:
    def __init__(self, data):
        self._data = data
    def raise_for_status(self):
        pass
    def json(self):
        return self._data

def test_backend_tool_is_an_sdk_function_tool():
    tool = mk_backend_tool(TOOL_DEF)
    assert isinstance(tool, FunctionTool)
    assert (tool.name, tool.description) == ("foo", "desc")
    assert tool.params_json_schema == TOOL_DEF["parameters"]

@pytest.mark.asyncio
async def test_backend_tool_posts_the_arguments_to_the_api(monkeypatch):
    captured = {}
    def fake_post(url, json, headers=None, timeout=None):
        captured['url'] = url
        captured['json'] = json
        captured['headers'] = headers
        return DummyResponse({"ok": True})
    monkeypatch.setattr(flow_runner.requests, 'post', fake_post)
    monkeypatch.setenv('INTERNAL_TOOLS_TOKEN', 'secret-token')
    tool = mk_backend_tool(TOOL_DEF)
    # what the SDK does when the model calls the tool
    result = await tool.on_invoke_tool(None, '{"a": 1}')
    assert json.loads(result) == {"ok": True}
    assert captured['url'].endswith('/internal/tools/foo-id')
    assert captured['json'] == {'a': 1}
    assert captured['headers'] == {'X-Internal-Token': 'secret-token'}

@pytest.mark.asyncio
async def test_backend_tool_reports_an_http_failure_to_the_model(monkeypatch):
    def failing_post(url, json, headers=None, timeout=None):
        raise requests.ConnectionError("api down")
    monkeypatch.setattr(flow_runner.requests, 'post', failing_post)
    result = await mk_backend_tool(TOOL_DEF).on_invoke_tool(None, '{"a": 1}')
    assert result == "Error calling tool foo: api down"

@pytest.mark.asyncio
async def test_build_agent_map_backend_and_function(monkeypatch):
    @function_tool
    def local_tool(text: str) -> str:
        """An in-process tool."""
        return text.upper()
    monkeypatch.setitem(flow_runner.LOCAL_TOOLS, 'fid', local_tool)
    payload = {
        'agents': [
            {
                'id': 'A',
                'instructions': 'instr',
                'tools': [
                    {'name': 'f', 'description': 'desc', 'parameters': {}, 'toolType': 'function', 'toolId': 'fid'},
                    {'name': 'b', 'description': 'desc', 'parameters': {}, 'toolType': 'backend', 'toolId': 'bid'},
                ],
            }
        ],
        'edges': []
    }
    id_map = await build_agent_map(payload)
    # Real SDK objects: Agent only runs with tools it knows how to call.
    assert isinstance(id_map['A'], Agent)
    assert all(isinstance(t, FunctionTool) for t in id_map['A'].tools)
    assert [t.name for t in id_map['A'].tools] == ['local_tool', 'b']

@pytest.mark.asyncio
@pytest.mark.parametrize("tool, message", [
    ({'name': 'f', 'toolType': 'function', 'toolId': 'nope'}, "Unknown function tool: 'nope'"),
    ('summarize', "Unsupported tool definition: 'summarize'"),
])
async def test_build_agent_map_rejects_a_tool_it_cannot_call(tool, message):
    with pytest.raises(ValueError, match=message):
        await build_agent_map({'agents': [{'id': 'A', 'tools': [tool]}], 'edges': []})
