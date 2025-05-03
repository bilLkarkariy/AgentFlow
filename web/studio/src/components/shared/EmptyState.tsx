import React from 'react';
import { useNavigate } from 'react-router-dom';

const EmptyState: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-20">
      <img
        src="https://via.placeholder.com/300x200?text=No+Flows+Yet"
        alt="Empty State"
        className="mb-4"
      />
      <h2 className="text-xl font-semibold">Aucun flow trouvé</h2>
      <p>Commencez par créer votre premier flow ou regardez la vidéo tuto.</p>
      <button
        onClick={() => navigate('/flows')}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Créer un flow
      </button>
      <div className="w-full max-w-md aspect-video">
        <iframe
          width="100%"
          height="100%"
          src="https://www.youtube.com/embed/dQw4w9WgXcQ"
          title="Tutoriel AgentFlow"
          frameBorder="0"
          allowFullScreen
        />
      </div>
    </div>
  );
};

export default EmptyState;
