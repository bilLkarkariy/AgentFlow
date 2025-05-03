import React from 'react';
import { Link } from 'react-router-dom';
import { useRuns } from '@/entities/run/api';
import type { Run } from '@/shared/types/run';
import StatusPill from '@/components/shared/StatusPill';

const RunTimeline: React.FC = () => {
  const { data, isLoading } = useRuns(1, 5);
  if (isLoading) return <p>Loading runs...</p>;
  const lastFive: Run[] = data?.items ?? [];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Activité récente</h2>
      <ul className="space-y-2">
        {lastFive.map((run: Run) => (
          <li key={run.id} className="flex justify-between items-center">
            <Link to={`/runs/${run.id}`} className="text-blue-600 hover:underline">
              {run.id}
            </Link>
            <StatusPill status={run.status} />
            <span className="text-sm text-gray-500">
              {new Date(run.startedAt).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RunTimeline;
