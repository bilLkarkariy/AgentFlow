import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import NodePalette from './NodePalette';

describe('NodePalette', () => {
  it('renders all palette items', () => {
    const onSelect = jest.fn();
    const { getByText } = render(<NodePalette onSelect={onSelect} />);
    const items = ['Départ', 'Agent', 'Condition', 'Boucle', 'Envoi email', 'Message Slack'];
    items.forEach((label) => {
      expect(getByText(label)).toBeInTheDocument();
    });
  });

  it('calls onSelect when an item is clicked', () => {
    const onSelect = jest.fn();
    const { getByText } = render(<NodePalette onSelect={onSelect} />);
    fireEvent.click(getByText('Départ'));
    expect(onSelect).toHaveBeenCalledWith('start');
  });
});
