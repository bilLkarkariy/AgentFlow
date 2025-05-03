import React from 'react';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import NodeBox from './NodeBox';

describe('NodeBox', () => {
  it('renders emailSend node with correct label and handles', () => {
    const { getByText, container } = render(
      <ReactFlowProvider>
        <NodeBox id="1" type="emailSend" data={{ label: 'Email' }} xPos={0} yPos={0} selected={false} zIndex={0} isConnectable={false} dragging={false} />
      </ReactFlowProvider>
    );
    expect(getByText('Email')).toBeInTheDocument();
    // one target + one source handle
    expect(container.querySelectorAll('.react-flow__handle').length).toBe(2);
  });

  it('renders start node with one handle', () => {
    const { getByText, container } = render(
      <ReactFlowProvider>
        <NodeBox id="1" type="start" data={{}} xPos={0} yPos={0} selected={false} zIndex={0} isConnectable={false} dragging={false} />
      </ReactFlowProvider>
    );
    expect(getByText('Start')).toBeInTheDocument();
    expect(container.querySelectorAll('.react-flow__handle').length).toBe(1);
  });

  it('renders condition node with two outputs and one input', () => {
    const { container } = render(
      <ReactFlowProvider>
        <NodeBox id="1" type="condition" data={{ label: 'If' }} xPos={0} yPos={0} selected={false} zIndex={0} isConnectable={false} dragging={false} />
      </ReactFlowProvider>
    );
    // one target + two source handles
    expect(container.querySelectorAll('.react-flow__handle').length).toBe(3);
  });
});
