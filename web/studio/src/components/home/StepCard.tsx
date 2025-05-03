import React from 'react';
import { motion } from 'framer-motion';

interface StepCardProps {
  stepNumber: number;
  title: string;
  onClick?: () => void;
}

const StepCard: React.FC<StepCardProps> = ({ stepNumber, title, onClick }) => (
  <motion.div
    onClick={onClick}
    className="bg-white rounded p-4 shadow hover:shadow-md cursor-pointer flex items-center gap-4"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: stepNumber * 0.1 }}
  >
    <div className="text-xl font-bold">{stepNumber}</div>
    <div className="text-sm font-medium">{title}</div>
  </motion.div>
);

export default StepCard;
