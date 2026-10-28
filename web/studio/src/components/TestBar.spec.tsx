import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TestBar from './TestBar';

const noop = () => {};

describe('TestBar', () => {
  it('runs the flow with the test message', () => {
    const onRun = jest.fn();
    render(<TestBar onSave={noop} onRun={onRun} onStep={noop} onStop={noop} />);

    fireEvent.change(screen.getByLabelText('Message de test'), { target: { value: 'Bonjour' } });
    fireEvent.click(screen.getByRole('button', { name: /Exécuter/ }));

    expect(onRun).toHaveBeenCalledWith('Bonjour');
  });

  it('runs the flow on Enter in the message field', () => {
    const onRun = jest.fn();
    render(<TestBar onSave={noop} onRun={onRun} onStep={noop} onStop={noop} />);
    const field = screen.getByLabelText('Message de test');

    fireEvent.change(field, { target: { value: 'Bonjour' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(onRun).toHaveBeenCalledWith('Bonjour');
  });

  it('shows the streamed token count', () => {
    render(<TestBar onSave={noop} onRun={noop} onStep={noop} onStop={noop} progress={42} />);
    expect(screen.getByText('42 jetons')).toBeInTheDocument();
  });
});
