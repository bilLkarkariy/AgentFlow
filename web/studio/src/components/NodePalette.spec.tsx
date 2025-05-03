import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import NodePalette from './NodePalette';

describe('NodePalette', () => {
  it('renders all palette items', () => {
    const onSelect = jest.fn();
    const { getByText } = render(<NodePalette onSelect={onSelect} />);
    const items = ['Start', 'Email Send', 'Slack Post', 'Condition', 'Loop', 'Agent Block'];
    items.forEach((label) => {
      expect(getByText(label)).toBeInTheDocument();
    });
  });

  it('calls onSelect when an item is clicked', () => {
    const onSelect = jest.fn();
    const { getByText } = render(<NodePalette onSelect={onSelect} />);
    fireEvent.click(getByText('Start'));
    expect(onSelect).toHaveBeenCalledWith('start');
  });
});
