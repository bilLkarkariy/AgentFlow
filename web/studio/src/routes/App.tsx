import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import BaseLayout from '@/components/shared/BaseLayout';
import DashboardPage from '../pages/DashboardPage';
import FlowsPage from '../pages/FlowsPage';
import RunsPage from '../pages/RunsPage';
import FlowLogsPage from '../pages/FlowLogsPage';
import DesignerPage from '../pages/DesignerPage';
import HubspotAuthPage from '../pages/HubspotAuthPage';
import HubspotTriggersPage from '../pages/HubspotTriggersPage';
import MarketplacePage from '../pages/MarketplacePage';
import HelpPage from '../pages/HelpPage';
import ProfilePage from '../pages/ProfilePage';
import SettingsPage from '../pages/SettingsPage';
import TemplatesGalleryPage from '../pages/TemplatesGalleryPage';
import ConnectorsPage from '../pages/ConnectorsPage';
import NotFoundPage from '../pages/NotFoundPage';
import WorkspaceSettingsPage from '../pages/WorkspaceSettingsPage';
import BillingPage from '../pages/BillingPage';
import TeamPage from '../pages/TeamPage';

const App: React.FC = () => (
  <Routes>
    <Route element={<BaseLayout />}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/templates" element={<TemplatesGalleryPage />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />}>
        <Route path="workspace" element={<WorkspaceSettingsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="team" element={<TeamPage />} />
      </Route>
      <Route path="/connectors" element={<ConnectorsPage />} />
      <Route path="/flows" element={<FlowsPage />} />
      <Route path="/flows/:agentId" element={<FlowsPage />}>
        <Route path="designer" element={<DesignerPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="logs/:runId" element={<FlowLogsPage />} />
        <Route path="hubspot" element={<HubspotAuthPage />} />
        <Route path="hubspot/triggers" element={<HubspotTriggersPage />} />
      </Route>
      <Route path="/runs" element={<RunsPage />} />
      <Route path="/runs/:runId" element={<FlowLogsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
);

export default App;
