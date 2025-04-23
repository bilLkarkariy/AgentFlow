import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

type Agent = {
  id: string;
  name: string;
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  const fetchAgents = () => {
    axios.get(`${baseUrl}/agents`).then((res) => setAgents(res.data));
  };

  useEffect(fetchAgents, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const { data } = await axios.post(`${baseUrl}/agents`, { name });
    setName('');
    fetchAgents();
    // Redirect to designer
    navigate(`/agents/${data.id}/designer`);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Agents</h1>

      <form onSubmit={submit} className="flex gap-2 items-end">
        <div className="flex flex-col">
          <label className="text-sm">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border px-2 py-1 rounded"
            placeholder="My agent"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-1 rounded self-end"
        >
          Create
        </button>
      </form>

      <table className="min-w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="py-1 px-2 text-left">Name</th>
            <th className="py-1 px-2">Actions</th>
            <th className="py-1 px-2">HubSpot</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-1 px-2">{a.name}</td>
              <td className="py-1 px-2 text-center">
                <Link
                  to={`/agents/${a.id}/designer`}
                  className="text-blue-600 hover:underline"
                >
                  Open designer
                </Link>
              </td>
              <td className="py-1 px-2 text-center">
                <Link
                  to={`/agents/${a.id}/hubspot`}
                  className="text-green-600 hover:underline"
                >
                  Manage HubSpot
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
