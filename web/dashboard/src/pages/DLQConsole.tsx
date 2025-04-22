import React from 'react';

const DLQConsole: React.FC = () => {
  const { VITE_RABBITMQ_HOST, VITE_RABBITMQ_MGMT_PORT, VITE_RABBITMQ_VHOST, VITE_RABBITMQ_DLQ_QUEUE } = import.meta.env;

  const url = `http://${VITE_RABBITMQ_HOST}:${VITE_RABBITMQ_MGMT_PORT}` +
    `/#/queues/${VITE_RABBITMQ_VHOST}/${VITE_RABBITMQ_DLQ_QUEUE}`;

  return (
    <div className="h-screen">
      <iframe
        src={url}
        title="RabbitMQ DLQ Console"
        className="w-full h-full border-0"
      />
    </div>
  );
};

export default DLQConsole;
