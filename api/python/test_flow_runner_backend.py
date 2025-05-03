import pytest
import flow_runner
from flow_runner import build_agent_map, mk_backend_tool

class DummyResponse:
    def __init__(self, data):
        self._data = data
    def raise_for_status(self):
        pass
    def json(self):
        return self._data

@pytest.mark.asyncio
async def test_backend_tool_calls_requests(monkeypatch):
    tool_def = {"name": "foo", "toolId": "foo-id", "description": "desc", "parameters": {}}
    captured = {}
    def fake_post(url, json, timeout=None):
        captured['url'] = url
        captured['json'] = json
        return DummyResponse({"ok": True})
    # Monkeypatch requests.post used in mk_backend_tool
    monkeypatch.setattr(flow_runner.requests, 'post', fake_post)
    tool = mk_backend_tool(tool_def)
    # calling the tool as a callable should invoke fake_post
    result = tool(a=1)
    assert result == {"ok": True}
    assert captured['url'].endswith('/internal/tools/foo-id')
    assert captured['json'] == {'a': 1}

@pytest.mark.asyncio
async def test_build_agent_map_backend_and_function(monkeypatch):
    calls = []
    # Stub function_tool.from_dict for function-type tools
    def fake_from_dict(t):
        calls.append(('from_dict', t))
        return 'func_tool'
    monkeypatch.setattr(flow_runner.function_tool, 'from_dict', fake_from_dict)
    backend_calls = []
    # Stub mk_backend_tool for backend-type tools
    monkeypatch.setattr(flow_runner, 'mk_backend_tool', lambda t: backend_calls.append(('mk', t)) or 'backend_tool')
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
    assert id_map['A'].tools == ['func_tool', 'backend_tool']
    assert calls == [('from_dict', payload['agents'][0]['tools'][0])]
    assert backend_calls == [('mk', payload['agents'][0]['tools'][1])]
