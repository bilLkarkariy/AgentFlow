import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/shared/DataTable';
import Modal from '../components/shared/Modal';
import { showToast } from '../components/shared/Toast';
import { useAgents, useCreateAgent } from '../entities/agent/api';
import type { Agent } from '../shared/types/agent';

export default function FlowsPage() {
  const navigate = useNavigate();
  const { data: flows = [], isLoading, error } = useAgents();
  const createFlow = useCreateAgent();
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<Agent | null>(null);

  if (error) showToast('Erreur chargement flows', 'error');

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const f = await createFlow.mutateAsync(newName);
      setNewName('');
      setIsCreating(false);
      showToast('Flow créé', 'success');
      navigate(`/flows/${f.id}/designer`);
    } catch {
      showToast('Erreur création flow', 'error');
    }
  };

  return (
    <>
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-semibold">Flows</h1>
        <button onClick={() => setIsCreating(true)} className="bg-blue-600 text-white px-4 py-1 rounded">Nouveau Flow</button>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <DataTable columns={[{ header: 'Name', accessor: 'name' }]} data={flows} onRowClick={(f) => setSelectedFlow(f)} />
        )}
      </div>
      <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title="Créer un flow">
        <form onSubmit={submitNew} className="space-y-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="border px-2 py-1 rounded w-full" placeholder="Nom flow" />
          <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded">Créer</button>
        </form>
      </Modal>
      <Modal isOpen={!!selectedFlow} onClose={() => setSelectedFlow(null)} title="Détails Flow">
        {selectedFlow && (
          <div className="space-y-2">
            <p><strong>ID:</strong> {selectedFlow.id}</p>
            <p><strong>Nom:</strong> {selectedFlow.name}</p>
            <button onClick={() => navigate(`/flows/${selectedFlow.id}/designer`)} className="mt-2 bg-blue-600 text-white px-4 py-1 rounded">Ouvrir designer</button>
          </div>
        )}
      </Modal>
    </>
  );
}
