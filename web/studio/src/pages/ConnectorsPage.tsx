import React, { useState, useEffect } from 'react';
import Modal from '../components/shared/Modal';
import StatusPill from '../components/shared/StatusPill';
import { showToast } from '../components/shared/Toast';
import { useHubspotCredentials, useHubspotAuthorize, useRemoveHubspotCredentials } from '../entities/hubspot/api';

type Connector = { id: string; name: string; icon: string };
const connectors: Connector[] = [
  { id: 'hubspot', name: 'Hubspot', icon: '/icons/hubspot.svg' },
];

const ConnectorsPage: React.FC = () => {
  const [selected, setSelected] = useState<Connector | null>(null);
  // Fetch Hubspot credentials
  const { data: hubCred, error } = useHubspotCredentials('workspace');
  const hubAuth = useHubspotAuthorize();
  const removeHub = useRemoveHubspotCredentials();
  const connected = !!hubCred;
  useEffect(() => {
    if (error) showToast('Erreur chargement credentials', 'error');
  }, [error]);

  const handleConnect = async () => {
    if (!selected) return;
    try {
      const { url } = await hubAuth.mutateAsync(selected.id);
      window.open(url, '_blank');
      showToast('OAuth window ouverte', 'success');
    } catch {
      showToast('Erreur OAuth', 'error');
    }
  };

  const handleDisconnect = async () => {
    if (!selected) return;
    try {
      await removeHub.mutateAsync(selected.id);
      showToast('Déconnecté', 'success');
      setSelected(null);
    } catch {
      showToast('Erreur déconnexion', 'error');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Connecteurs</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {connectors.map(c => (
          <div key={c.id} className="border rounded shadow p-4 flex items-center space-x-4">
            <img src={c.icon} alt={c.name} className="h-12 w-12" />
            <div className="flex-1">
              <h2 className="font-semibold">{c.name}</h2>
              <StatusPill status={connected ? 'connected' : 'disconnected'} />
            </div>
            <button
              onClick={() => setSelected(c)}
              className={`px-4 py-2 rounded ${connected ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}
            >
              {connected ? 'Déconnecter' : 'Connecter'}
            </button>
          </div>
        ))}
      </div>
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''}>
        <div className="p-4">
          <p>Gestion du connecteur {selected?.name}</p>
          <button
            onClick={() => selected && (connected ? handleDisconnect() : handleConnect())}
            className={`px-4 py-2 rounded mt-2 ${connected ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}
          >
            {connected ? 'Déconnecter' : 'Connecter'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ConnectorsPage;
