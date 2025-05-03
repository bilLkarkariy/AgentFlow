import React, { useState, useEffect } from 'react';
import DataTable, { Column } from '../components/shared/DataTable';
import Modal from '../components/shared/Modal';
import { showToast } from '../components/shared/Toast';
import { useRuns, useRetryRun, useCancelRun } from '../entities/run/api';
import type { Run } from '../shared/types/run';

const RunsPage: React.FC = () => {
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const { data, isLoading, error } = useRuns(page, pageSize);
  const runs = data?.items ?? [];
  const total = data?.total ?? 0;
  const retryMutation = useRetryRun();
  const cancelMutation = useCancelRun();

  useEffect(() => {
    if (retryMutation.isSuccess) showToast('Retry lancé', 'success');
    if (retryMutation.isError) showToast('Erreur retry', 'error');
  }, [retryMutation.isSuccess, retryMutation.isError]);

  useEffect(() => {
    if (cancelMutation.isSuccess) showToast('Annulation réussie', 'success');
    if (cancelMutation.isError) showToast('Erreur annulation', 'error');
  }, [cancelMutation.isSuccess, cancelMutation.isError]);

  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  if (error) showToast('Erreur chargement runs', 'error');

  const columns: Column<Run & { startedAtFormatted: string; duration: string }>[] = [
    { header: 'Run ID', accessor: 'id' },
    { header: 'Démarré', accessor: 'startedAtFormatted' },
    { header: 'Durée', accessor: 'duration' },
    { header: 'Statut', accessor: 'status' },
    { header: 'Actions', accessor: 'id', cell: (row: Run & { startedAtFormatted: string; duration: string }) => (
      <div className="flex gap-2">
        <button
          onClick={e => { e.stopPropagation(); retryMutation.mutate(row.id); }}
          className="px-2 py-1 bg-yellow-500 text-white rounded text-sm"
        >
          Retry
        </button>
        {!row.endedAt && (
          <button
            onClick={e => { e.stopPropagation(); cancelMutation.mutate(row.id); }}
            disabled={cancelMutation.status === 'pending'}
            className="px-2 py-1 bg-red-500 text-white rounded text-sm"
          >
            Annuler
          </button>
        )}
      </div>
    ) },
  ];

  const dataForTable = runs.map(r => ({
    ...r,
    startedAtFormatted: new Date(r.startedAt).toLocaleString(),
    duration: r.endedAt
      ? `${Math.floor((new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)}s`
      : 'En cours',
  }));

  return (
    <>
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Executions récentes</h1>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <>
            <DataTable columns={columns as any} data={dataForTable} onRowClick={(r: Run & { startedAtFormatted: string; duration: string }) => setSelectedRun(r as Run)} />
            <div className="flex justify-end gap-2 p-4">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-gray-200 rounded"
              >
                Précédent
              </button>
              <span>Page {page} / {Math.ceil(total / pageSize)}</span>
              <button
                onClick={() => setPage(p => (p * pageSize < total ? p + 1 : p))}
                disabled={page * pageSize >= total}
                className="px-3 py-1 bg-gray-200 rounded"
              >
                Suivant
              </button>
            </div>
          </>
        )}
      </div>
      <Modal
        isOpen={!!selectedRun}
        onClose={() => setSelectedRun(null)}
        title="Détails Exécution"
      >
        {selectedRun && (
          <div className="space-y-2">
            <p><strong>ID:</strong> {selectedRun.id}</p>
            <p><strong>Statut:</strong> {selectedRun.status}</p>
            <p><strong>Démarré:</strong> {new Date(selectedRun.startedAt).toLocaleString()}</p>
          </div>
        )}
      </Modal>
    </>
  );
};

export default RunsPage;
