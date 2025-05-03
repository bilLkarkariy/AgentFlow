import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useHubspotStore } from '../store/hubspotStore';

const HubspotAuthPage: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const { credentials, fetchCredentials, removeCredentials } = useHubspotStore(agentId);

  useEffect(() => {
    if (agentId) fetchCredentials(agentId);
  }, [agentId, fetchCredentials]);

  const handleConnect = async () => {
    if (!agentId) return;
    const resp = await axios.get(`/api/hubspot/authorize/${agentId}`);
    window.location.href = resp.data.url;
  };

  const handleDisconnect = async () => {
    if (!agentId) return;
    removeCredentials(agentId);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">HubSpot Integration</h1>
      {credentials ? (
        <div className="space-y-4">
          <p>
            Connected. Expires at:{' '}
            {new Date(credentials.expiresAt).toLocaleString()}
          </p>
          <div className="space-x-2">
            <button
              onClick={handleDisconnect}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Disconnect
            </button>
            {agentId && (
              <Link
                to={`/agents/${agentId}/hubspot/triggers`}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Manage Triggers
              </Link>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Connect to HubSpot
        </button>
      )}
    </div>
  );
};

export default HubspotAuthPage;
