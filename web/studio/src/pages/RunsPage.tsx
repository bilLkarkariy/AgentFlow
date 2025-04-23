import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

type Run = { id: string; startedAt: string; status: string };

const RunsPage: React.FC = () => {
  const [runs, setRuns] = useState<Run[]>([]);
  const fetchRuns = async () => {
    const { data } = await axios.get<Run[]>(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/runs`,
    );
    setRuns(data);
  };
  useEffect(() => {
    fetchRuns();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Executions récentes</h1>
      <table className="w-full bg-white shadow rounded">
        <thead>
          <tr className="text-left border-b">
            <th className="p-2">RunId</th>
            <th className="p-2">Start</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b hover:bg-gray-50">
              <td className="p-2 text-blue-600">
                <Link to={`/runs/${r.id}`}>{r.id}</Link>
              </td>
              <td className="p-2">{new Date(r.startedAt).toLocaleString()}</td>
              <td className="p-2 capitalize">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RunsPage;
