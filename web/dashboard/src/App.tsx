import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import DLQConsole from './pages/DLQConsole';

const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/dlq" element={<DLQConsole />} />
  </Routes>
);

export default App;
