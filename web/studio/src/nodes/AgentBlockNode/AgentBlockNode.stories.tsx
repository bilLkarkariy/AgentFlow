import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import AgentBlockNode from './AgentBlockNode';

export default {
  title: 'Components/AgentBlockNode',
  component: AgentBlockNode,
  decorators: [Story => (
    <ReactFlowProvider>
      <div style={{ width: 300, padding: 20 }}>
        <Story />
      </div>
    </ReactFlowProvider>
  )],
};

const Template = args => <AgentBlockNode id="1" data={args.data} />;

export const Default = Template.bind({});
Default.args = {
  data: { prompt: '', model: 'o4-mini', temperature: 0.7 },
};

export const WithResult = Template.bind({});
WithResult.args = {
  data: { prompt: 'Hello', model: 'o4-mini', temperature: 0.7 },
};
