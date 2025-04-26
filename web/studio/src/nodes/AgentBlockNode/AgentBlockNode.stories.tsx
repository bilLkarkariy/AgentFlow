import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import AgentBlockNode from './AgentBlockNode';
import { ComponentStory, ComponentMeta } from '@storybook/react';

export default {
  title: 'Components/AgentBlockNode',
  component: AgentBlockNode,
  decorators: [(Story: any) => (
    <ReactFlowProvider>
      <div style={{ width: 300, padding: 20 }}>
        <Story />
      </div>
    </ReactFlowProvider>
  )],
} as ComponentMeta<typeof AgentBlockNode>;

const Template: ComponentStory<typeof AgentBlockNode> = (args) => <AgentBlockNode {...args} />;

export const Default = Template.bind({});
Default.args = {
  id: '1',
  data: { prompt: '', model: 'o4-mini', temperature: 0.7 },
};

export const WithResult = Template.bind({});
WithResult.args = {
  id: '1',
  data: { prompt: 'Hello', model: 'o4-mini', temperature: 0.7 },
};
