import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable, { Column } from '../components/shared/DataTable';
import Modal from '../components/shared/Modal';
import { showToast } from '../components/shared/Toast';
import { useAgents, useCreateAgent } from '../entities/agent/api';
import type { Agent } from '../shared/types/agent';

export default function AgentsPage() {
  const navigate = useNavigate();
  const { data: agents = [], isLoading, error } = useAgents();
  const createAgent = useCreateAgent();
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  if (error) showToast('Erreur chargement agents', 'error');

  const columns: Column<Agent>[] = [{ header: 'Name', accessor: 'name' }];
  return (
    <>
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-semibold">Agents</h1>
        <button onClick={() => setIsCreating(true)} className="bg-blue-600 text-white px-4 py-1 rounded">Nouveau Agent</button>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <DataTable columns={columns} data={agents} onRowClick={(a) => setSelectedAgent(a)} />
        )}
      </div>
      <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title="Créer un agent">
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            const agent = await createAgent.mutateAsync(newName);
            setNewName('');
            setIsCreating(false);
            showToast('Agent créé', 'success');
            navigate(`/agents/${agent.id}/designer`);
          } catch {
            showToast('Erreur création agent', 'error');
          }
        }} className="space-y-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="border px-2 py-1 rounded w-full" placeholder="Nom agent" />
          <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded">Créer</button>
        </form>
      </Modal>
      <Modal isOpen={!!selectedAgent} onClose={() => setSelectedAgent(null)} title="Détails Agent">
        {selectedAgent && (
          <div className="space-y-2">
            <p><strong>ID:</strong> {selectedAgent.id}</p>
            <p><strong>Nom:</strong> {selectedAgent.name}</p>
            <button onClick={() => navigate(`/agents/${selectedAgent.id}/designer`)} className="mt-2 bg-blue-600 text-white px-4 py-1 rounded">Ouvrir designer</button>
          </div>
        )}
      </Modal>
    </>
  );
}
