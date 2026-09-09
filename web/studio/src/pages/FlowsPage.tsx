import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import DataTable from '../components/shared/DataTable';
import Modal from '../components/shared/Modal';
import { showToast } from '../components/shared/Toast';
import { useAgents, useCreateAgent } from '../entities/agent/api';
import type { Agent } from '../shared/types/agent';

export default function FlowsPage() {
  const navigate = useNavigate();
  const isChildRoute = /\/flows\/[^/]+\/.+/.test(useLocation().pathname);
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
      {!isChildRoute && (
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[19px] font-semibold text-ink tracking-[-0.01em]">Flows</h1>
              <p className="text-[13px] text-inkmute mt-1">
                {flows?.length ?? 0} flow(s). Ouvrez-en un pour éditer son graphe d'agents.
              </p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-medium rounded-md bg-ink text-white hover:bg-ink/90 transition-colors"
            >
              Nouveau flow
            </button>
          </div>
          {isLoading ? (
            <p className="text-[13px] text-inkmute">Chargement…</p>
          ) : (
            <DataTable columns={[{ header: 'Nom', accessor: 'name' }]} data={flows} onRowClick={(f) => setSelectedFlow(f)} />
          )}
        </div>
      )}
      <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title="Créer un flow">
        <form onSubmit={submitNew} className="space-y-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="border border-line rounded-md px-2.5 py-2 text-[13px] w-full focus:outline-none focus:border-agent" placeholder="Nom flow" />
          <button type="submit" className="h-9 px-3.5 text-[13px] font-medium rounded-md bg-ink text-white hover:bg-ink/90 transition-colors">Créer le flow</button>
        </form>
      </Modal>
      <Modal isOpen={!!selectedFlow} onClose={() => setSelectedFlow(null)} title="Détails Flow">
        {selectedFlow && (
          <div className="space-y-2">
            <p className="text-[13px] text-inkmute">Identifiant <span className="measure">{selectedFlow.id}</span></p>
            <p className="text-[13px] text-inkmute">Nom <span className="text-ink font-medium">{selectedFlow.name}</span></p>
            <button onClick={() => navigate(`/flows/${selectedFlow.id}/designer`)} className="mt-3 h-9 px-3.5 text-[13px] font-medium rounded-md bg-ink text-white hover:bg-ink/90 transition-colors">Ouvrir le designer</button>
          </div>
        )}
      </Modal>
      <Outlet />
    </>
  );
}
