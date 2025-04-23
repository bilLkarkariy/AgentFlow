import React from 'react';
import { useParams } from 'react-router-dom';
import LogViewer from '../features/flowLogs/LogViewer';

const FlowLogsPage: React.FC = () => {
  const { runId = '' } = useParams();

  if (!runId) {
    return <p className="p-6 text-red-600">runId manquant</p>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Logs d’exécution {runId}</h1>
      <LogViewer runId={runId} />
    </div>
  );
};

export default FlowLogsPage;
