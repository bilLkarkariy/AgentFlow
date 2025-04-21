import React, { useState, useEffect } from 'react';
import { getRoiStats } from '../api/dashboard';
import DateRangePicker from '../components/DateRangePicker';
import RoiChart from '../components/RoiChart';
import type { RoiStat } from '../types';

const Dashboard: React.FC = () => {
  const [from, setFrom] = useState<string>(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<RoiStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRoiStats(from, to);
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-5">Dashboard ROI</h1>
      <DateRangePicker
        from={from}
        to={to}
        onChangeFrom={setFrom}
        onChangeTo={setTo}
        onApply={fetchData}
      />
      {loading && <p className="text-neutral-500 py-4">Chargement...</p>}
      {error && <p className="text-danger mb-4">{error}</p>}
      {!loading && !error && data.length > 0 && (
        <div className="bg-white shadow-sm rounded-lg p-4 mt-6">
          <RoiChart data={data} />
        </div>
      )}
      {!loading && !error && data.length === 0 && (
        <p className="text-neutral-500 mt-4">Aucune donnée pour cette période.</p>
      )}
    </div>
  );
};

export default Dashboard;
