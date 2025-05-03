import pytest
import asyncio
import json
from agents import Agent
from flow_runner import build_agent_map

@ pytest.mark.asyncio
async def test_build_agent_map_basic():
    payload = {"agents": [{"id": "A", "instructions": "do something", "tools": []}], "edges": []}
    id_map = await build_agent_map(payload)
    assert "A" in id_map
    assert isinstance(id_map["A"], Agent)

@ pytest.mark.asyncio
async def test_build_agent_map_handoff():
    payload = {
        "agents": [
            {"id": "A", "instructions": "first", "tools": []},
            {"id": "B", "instructions": "second", "tools": []}
        ],
        "edges": [["A", "B"]]
    }
    id_map = await build_agent_map(payload)
    # Agent A should hand off to B
    assert id_map["B"] in id_map["A"].handoffs
    # Agent B should have no handoffs
    assert not id_map["B"].handoffs
