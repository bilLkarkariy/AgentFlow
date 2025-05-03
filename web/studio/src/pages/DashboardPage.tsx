import React from 'react';
import { useAgents } from '@/entities/agent/api';
import EmptyState from '@/components/shared/EmptyState';
import HeroCTA from '@/components/home/HeroCTA';
import StepCard from '@/components/home/StepCard';
import RunTimeline from '@/components/home/RunTimeline';
import EUCompliance from '@/components/home/EUCompliance';

const DashboardPage: React.FC = () => {
  const { data: flows = [], isLoading: flowsLoading } = useAgents();
  if (flowsLoading) {
    return <div className="p-6 space-y-8 animate-pulse">Loading...</div>;
  }
  const isFTU = flows.length === 0;
  return (
    <div className="p-6 space-y-8">
      <HeroCTA />
      <div className="grid grid-cols-3 gap-4 relative">
        <div className={`relative ${isFTU ? 'ring-2 ring-indigo-600 rounded-lg' : ''}`}>
          <StepCard stepNumber={1} title="Connecter Gmail" />
          {isFTU && (
            <div id="tutorial-popover" className="absolute -top-8 left-0 bg-indigo-600 text-white text-xs px-2 py-1 rounded">
              Commencez ici
            </div>
          )}
        </div>
        <StepCard stepNumber={2} title="Choisir un template" />
        <StepCard stepNumber={3} title="Lancer un test" />
      </div>
      {isFTU ? (
        <EmptyState />
      ) : (
        <RunTimeline />
      )}
      <div className="mt-6">
        <EUCompliance />
      </div>
    </div>
  );
};

export default DashboardPage;
