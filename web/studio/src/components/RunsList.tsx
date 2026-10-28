import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE_URL } from '../shared/lib/env';

interface RunsListProps {
  agentId: string;
}

const RunsList: React.FC<RunsListProps> = ({ agentId }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['runs', agentId],
    queryFn: () =>
      axios
        .get(`${API_BASE_URL}/flows/${agentId}/runs?limit=5`)
        .then((res) => res.data),
    retry: false,
  });

  const Titre = () => (
    <div className="label pb-2">
      Dernières exécutions
    </div>
  );

  if (isLoading) return <div><Titre /><div className="text-[13px] text-inkmute/70">Chargement…</div></div>;
  if (error || !Array.isArray(data)) {
    return <div><Titre /><div className="text-[13px] text-inkmute/70">Aucune exécution pour ce flow.</div></div>;
  }
  if (data.length === 0) {
    return <div><Titre /><div className="text-[13px] text-inkmute/70">Aucune exécution pour ce flow.</div></div>;
  }

  return (
    <div>
      <Titre />
      <ul className="space-y-1.5">
        {data.map((run: any) => (
          <li key={run.id} className="flex items-center justify-between text-xs">
            <span className="measure truncate mr-2">{String(run.id).slice(0, 8)}</span>
            <span className="text-[12px] text-inkmute">{run.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RunsList;
