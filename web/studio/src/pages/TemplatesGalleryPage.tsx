import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/shared/Modal';
import { showToast } from '../components/shared/Toast';
import { useCreateAgent } from '../entities/agent/api';

type Template = { id: string; name: string; tags: string[]; thumbnail: string };

const templates: Template[] = [
  { id: 'invoice-processor', name: 'Invoice Processor', tags: ['accounting'], thumbnail: '/thumbnails/invoice.png' },
  { id: 'support-triage', name: 'Support Triage', tags: ['support'], thumbnail: '/thumbnails/support.png' },
  { id: 'marketing-digest', name: 'Marketing Digest', tags: ['marketing'], thumbnail: '/thumbnails/marketing.png' },
];

const allTags = Array.from(new Set(templates.flatMap(t => t.tags)));

const TemplatesGalleryPage: React.FC = () => {
  const navigate = useNavigate();
  const createFlow = useCreateAgent();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [params, setParams] = useState<Record<string, any>>({});
  const totalSteps = 2;

  const filtered = activeTags.length
    ? templates.filter(t => t.tags.some(tag => activeTags.includes(tag)))
    : templates;

  const openWizard = (template: Template) => {
    setSelectedTemplate(template);
    setIsWizardOpen(true);
    setStep(0);
  };

  const toggleTag = (tag: string) => {
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const submitWizard = async () => {
    if (!selectedTemplate) return;
    try {
      const flow = await createFlow.mutateAsync(selectedTemplate.name);
      showToast('Flow créé depuis template', 'success');
      navigate(`/flows/${flow.id}/designer`);
    } catch {
      showToast('Erreur création flow', 'error');
    }
    setIsWizardOpen(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Templates Gallery</h1>
      <div className="mb-4 space-x-2">
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`px-3 py-1 rounded ${activeTags.includes(tag) ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(t => (
          <div key={t.id} className="border rounded shadow p-4 flex flex-col">
            <img
              src={t.thumbnail}
              alt={t.name}
              className="h-32 object-cover mb-2 rounded"
            />
            <h2 className="font-semibold">{t.name}</h2>
            <div className="flex flex-wrap gap-1 mb-2">
              {t.tags.map(tag => (
                <span key={tag} className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {tag}
                </span>
              ))}
            </div>
            <button
              onClick={() => openWizard(t)}
              className="mt-auto bg-blue-600 text-white px-4 py-2 rounded"
            >
              Utiliser
            </button>
          </div>
        ))}
      </div>
      <Modal isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} title={selectedTemplate?.name || 'Wizard'}>
        {selectedTemplate && (
          <div className="space-y-4">
            {step === 0 && (
              <div>
                <h3 className="font-semibold mb-2">Étape 1 : Choisir triggers</h3>
                {['onCreate', 'onUpdate', 'onSchedule'].map(trg => (
                  <div key={trg}>
                    <label>
                      <input
                        type="checkbox"
                        checked={triggers.includes(trg)}
                        onChange={() => setTriggers(prev => prev.includes(trg) ? prev.filter(x => x !== trg) : [...prev, trg])}
                      />{' '}
                      {trg}
                    </label>
                  </div>
                ))}
              </div>
            )}
            {step === 1 && (
              <div>
                <h3 className="font-semibold mb-2">Étape 2 : Paramètres</h3>
                <label className="block mb-1">Param key</label>
                <input
                  type="text"
                  value={params.key || ''}
                  onChange={(e) => setParams({ ...params, key: e.target.value })}
                  className="border px-2 py-1 rounded w-full"
                  placeholder="value"
                />
              </div>
            )}
            {step === totalSteps && (
              <div>
                <h3 className="font-semibold mb-2">Étape 3 : Aperçu du Designer</h3>
                <p>Aperçu du canvas du designer pour le template <strong>{selectedTemplate.name}</strong>.</p>
              </div>
            )}
            <div className="flex justify-between">
              <button disabled={step === 0} onClick={() => setStep(prev => prev - 1)} className="px-4 py-2 bg-gray-200 rounded">
                Précédent
              </button>
              {step < totalSteps ? (
                <button onClick={() => setStep(prev => prev + 1)} className="px-4 py-2 bg-blue-600 text-white rounded">
                  Suivant
                </button>
              ) : (
                <button onClick={submitWizard} className="px-4 py-2 bg-green-600 text-white rounded">
                  Créer
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TemplatesGalleryPage;
