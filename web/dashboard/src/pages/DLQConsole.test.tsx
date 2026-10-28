import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DLQConsole from './DLQConsole';

describe('DLQ console', () => {
  it('embeds the RabbitMQ dead-letter queue and Bull Board side by side', () => {
    render(<DLQConsole />);

    expect(screen.getByTitle('RabbitMQ DLQ')).toHaveAttribute(
      'src',
      'http://localhost:15672/#/queues/%2F/agentflow.flow-run.dlq',
    );
    expect(screen.getByTitle('BullMQ DLQ')).toHaveAttribute(
      'src',
      'http://localhost:3000/admin/queues',
    );
  });
});
