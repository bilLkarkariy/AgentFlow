import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { RoiStat } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Props {
  data: RoiStat[];
}

const RoiChart: React.FC<Props> = ({ data }) => {
  const labels = data.map((item) => item.date);
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Minutes économisées',
        data: data.map((item) => item.timeSavedMinutes),
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.5)',
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: 'Économies de temps'}
    },
    scales: {
      x: { title: { display: true, text: 'Date' } },
      y: { title: { display: true, text: 'Minutes' } }
    }
  };

  return <Line data={chartData} options={options} />;
};

export default RoiChart;
