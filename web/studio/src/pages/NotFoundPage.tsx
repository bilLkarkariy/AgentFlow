import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="p-6 text-center">
      <h1 className="text-3xl font-bold mb-4">404 – Page non trouvée</h1>
      <button
        onClick={() => navigate(-1)}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Retour
      </button>
    </div>
  );
};

export default NotFoundPage;
