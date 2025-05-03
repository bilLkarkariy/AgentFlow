import React from 'react';
import { motion } from 'framer-motion';

interface MiniKPIProps {
  title: string;
  value: string;
}

const MiniKPI: React.FC<MiniKPIProps> = ({ title, value }) => (
  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="bg-white p-4 rounded-2xl shadow">
    <div className="text-sm text-gray-500">{title}</div>
    <div className="text-2xl font-bold">{value}</div>
  </motion.div>
);

export default MiniKPI;
