import React from 'react';
import { API_BASE_URL, DLQ_QUEUE, RABBITMQ_MGMT_URL } from '../config';

const DLQConsole: React.FC = () => {
  const rabbitUrl = `${RABBITMQ_MGMT_URL}/#/queues/${DLQ_QUEUE}`;
  const bullUrl = `${API_BASE_URL}/admin/queues`;

  return (
    <div className="h-screen grid grid-cols-2 gap-2">
      <div className="border">
        <h2 className="p-2 font-bold">RabbitMQ DLQ</h2>
        <iframe src={rabbitUrl} title="RabbitMQ DLQ" className="w-full h-[calc(100%-2rem)]" />
      </div>
      <div className="border">
        <h2 className="p-2 font-bold">BullMQ DLQ</h2>
        <iframe src={bullUrl} title="BullMQ DLQ" className="w-full h-[calc(100%-2rem)]" />
      </div>
    </div>
  );
};

export default DLQConsole;
