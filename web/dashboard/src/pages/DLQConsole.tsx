import React from 'react';

const DLQConsole: React.FC = () => {
  const {
    VITE_RABBITMQ_HOST,
    VITE_RABBITMQ_MGMT_PORT,
    VITE_RABBITMQ_VHOST,
    VITE_RABBITMQ_DLQ_QUEUE,
    VITE_API_BASE_URL,
  } = import.meta.env;

  const rabbitUrl = `http://${VITE_RABBITMQ_HOST}:${VITE_RABBITMQ_MGMT_PORT}` +
    `/#/queues/${VITE_RABBITMQ_VHOST}/${VITE_RABBITMQ_DLQ_QUEUE}`;
  const bullUrl = `${VITE_API_BASE_URL}/admin/queues`;

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
