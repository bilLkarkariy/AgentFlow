import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import NodeInspector from './NodeInspector';
import { ReactFlowProvider, Node } from 'reactflow';

describe('NodeInspector', () => {
  const updateNode = jest.fn();

  it('renders prompt when no node is selected', () => {
    const { getByText } = render(
      <NodeInspector node={undefined} updateNode={updateNode} />
    );
    expect(getByText('Select a node')).toBeInTheDocument();
  });

  it('renders form fields for emailSend node and calls update on change', () => {
    const node: Node = {
      id: '1',
      type: 'emailSend',
      position: { x: 0, y: 0 },
      data: { label: 'Email', to: 'user@example.com', subject: 'Hello' }
    } as any;

    const { getByLabelText } = render(
      <ReactFlowProvider>
        <NodeInspector node={node} updateNode={updateNode} />
      </ReactFlowProvider>
    );

    const toInput = getByLabelText('To') as HTMLInputElement;
    expect(toInput.value).toBe('user@example.com');
    fireEvent.change(toInput, { target: { value: 'new@example.com' } });
    expect(updateNode).toHaveBeenCalledWith('1', { to: 'new@example.com' });

    const subjectInput = getByLabelText('Subject') as HTMLInputElement;
    expect(subjectInput.value).toBe('Hello');
    fireEvent.change(subjectInput, { target: { value: 'World' } });
    expect(updateNode).toHaveBeenCalledWith('1', { subject: 'World' });

    const labelInput = getByLabelText('Label') as HTMLInputElement;
    expect(labelInput.value).toBe('Email');
    fireEvent.change(labelInput, { target: { value: 'NewLabel' } });
    expect(updateNode).toHaveBeenCalledWith('1', { label: 'NewLabel' });
  });
});
