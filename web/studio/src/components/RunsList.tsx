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
  });

  if (isLoading) return <div>Loading runs...</div>;
  if (error) return <div>Error loading runs</div>;

  return (
    <div className="mb-4">
      <h3 className="font-bold mb-2">Last runs</h3>
      <ul className="list-disc pl-5">
        {data.map((run: any) => (
          <li key={run.id} className="text-sm">
            {run.id} - {run.status}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RunsList;
