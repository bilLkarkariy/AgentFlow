import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import LogViewer from '../features/flowLogs/LogViewer';

const FlowLogsPage: React.FC = () => {
  const { runId = '' } = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'success' | 'error'>('all');

  if (!runId) {
    return <p className="p-6 text-red-600">runId manquant</p>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Logs d’exécution {runId}</h1>
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Recherche logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border px-2 py-1 rounded flex-1"
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as any)}
          className="border px-2 py-1 rounded"
        >
          <option value="all">Tous niveaux</option>
          <option value="info">Info</option>
          <option value="success">Succès</option>
          <option value="error">Erreur</option>
        </select>
      </div>
      <LogViewer runId={runId} searchTerm={searchTerm} levelFilter={levelFilter} />
    </div>
  );
};

export default FlowLogsPage;
