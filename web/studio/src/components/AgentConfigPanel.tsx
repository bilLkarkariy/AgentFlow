import React, { useState } from 'react';
import { useFlowStore } from '../store/useFlowStore';
import './AgentConfigPanel.css';

export const AgentConfigPanel: React.FC = () => {
  const selectedId = useFlowStore((s) => s.selectedNodeId);
  const node = useFlowStore((s) => s.nodes.find((n) => n.id === selectedId));
  const update = useFlowStore((s) => s.updateNodeData);
  const mappings = useFlowStore((s) => s.mappings);
  const addMapping = useFlowStore((s) => s.addMapping);
  const removeMapping = useFlowStore((s) => s.removeMapping);

  // Tous les hooks avant le premier return conditionnel (React #310).
  const [source, setSource] = useState<string>('');
  const [target, setTarget] = useState<string>('');
  const allNodes = useFlowStore((s) => s.nodes);

  if (!node) return null;

  const data = node.data || {};
  const { temperature = 0.7, model = 'gpt-4o-mini', max_tokens = 256 } = data;

  const nodeOptions = allNodes.map((n) => ({ id: n.id, label: n.data.label || n.id }));

  return (
    <div className="agent-config-panel">
      <h3>Configuration de l'agent</h3>
      <label>
        Modèle
        <input
          type="text"
          value={model}
          onChange={(e) => update(node.id, { model: e.target.value })}
        />
      </label>
      <label>
        Température
        <input
          type="number"
          step="0.1"
          min="0"
          max="1"
          value={temperature}
          onChange={(e) => update(node.id, { temperature: parseFloat(e.target.value) })}
        />
      </label>
      <label>
        Jetons max
        <input
          type="number"
          min="1"
          value={max_tokens}
          onChange={(e) => update(node.id, { max_tokens: parseInt(e.target.value, 10) })}
        />
      </label>
      <div className="mapping-section">
        <h4>Passage de sortie vers entrée</h4>
        <div>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Bloc source…</option>
            {nodeOptions.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}
          </select>
          <span>→</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Bloc cible…</option>
            {nodeOptions.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}
          </select>
          <button disabled={!source || !target} onClick={() => { addMapping({ output: source, input: target }); setSource(''); setTarget(''); }}>Ajouter</button>
        </div>
        <ul>
          {mappings.map((m, i) => (<li key={i}>{m.output} → {m.input} <button onClick={() => removeMapping(m)}>Retirer</button></li>))}
        </ul>
      </div>
    </div>
  );
};
