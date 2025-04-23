import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RunsPage from '../pages/RunsPage';
import FlowLogsPage from '../pages/FlowLogsPage';
import DesignerPage from '../pages/DesignerPage';
import AgentsPage from '../pages/AgentsPage';
import HubspotAuthPage from '../pages/HubspotAuthPage';
import HubspotTriggersPage from '../pages/HubspotTriggersPage';

const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/agents" replace />} />
    <Route path="/agents" element={<AgentsPage />} />
    <Route path="/agents/:agentId/designer" element={<DesignerPage />} />
    <Route path="/agents/:agentId/hubspot" element={<HubspotAuthPage />} />
    <Route path="/agents/:agentId/hubspot/triggers" element={<HubspotTriggersPage />} />
    <Route path="/runs" element={<RunsPage />} />
    <Route path="/runs/:runId" element={<FlowLogsPage />} />
  </Routes>
);

export default App;
