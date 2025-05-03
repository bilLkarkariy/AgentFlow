import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useHubspotTriggers, useAddHubspotTrigger, useDeleteHubspotTrigger } from '../entities/hubspot/api';

const EVENTS = [
  'contact.propertyChange',
  'deal.creation',
  'deal.propertyChange',
];

const HubspotTriggersPage: React.FC = () => {
  const { agentId } = useParams();
  const { data: triggers = [] } = useHubspotTriggers(agentId!);
  const [newEvent, setNewEvent] = useState(EVENTS[0]);
  const addTrigger = useAddHubspotTrigger(agentId!);
  const deleteTrigger = useDeleteHubspotTrigger(agentId!);

  if (!agentId) return null;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold mb-4">HubSpot Triggers</h1>
      <div className="flex items-center space-x-2">
        <select value={newEvent} onChange={(e) => setNewEvent(e.target.value)} className="border p-2 rounded">
          {EVENTS.map((ev) => (
            <option key={ev} value={ev}>{ev}</option>
          ))}
        </select>
        <button onClick={() => addTrigger.mutate(newEvent)} className="bg-blue-600 text-white px-4 py-2 rounded">
          Add Trigger
        </button>
      </div>

      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Type</th>
            <th></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {triggers.map((t) => (
            <tr key={t.id}>
              <td className="px-6 py-4 whitespace-nowrap">{t.eventType}</td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onClick={() => deleteTrigger.mutate(t.id)} className="text-red-600 hover:text-red-800">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HubspotTriggersPage;
