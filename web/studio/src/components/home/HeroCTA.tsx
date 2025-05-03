import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const HeroCTA: React.FC = () => {
  const navigate = useNavigate();
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-10 rounded-2xl shadow-xl mb-8"
    >
      <h2 className="text-4xl font-bold mb-4">Bienvenue sur AgentFlow Studio</h2>
      <p className="mb-6">Créez votre flow en quelques clics et automatisez vos tâches.</p>
      <button
        onClick={() => navigate('/flows')}
        className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100"
      >
        Créer un flow
      </button>
    </motion.section>
  );
};

export default HeroCTA;
