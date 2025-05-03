import React from 'react';

interface TestBarProps {
  onSave: () => void;
  onRun: () => void;
  onStep: () => void;
  onStop: () => void;
  progress?: number;
}

const TestBar: React.FC<TestBarProps> = ({ onSave, onRun, onStep, onStop, progress = 0 }) => (
  <div className="p-2 bg-gray-100 flex gap-2 border-b">
    <button onClick={onSave} className="bg-blue-600 text-white px-3 py-1 rounded">Save</button>
    <button onClick={onRun} className="bg-green-600 text-white px-3 py-1 rounded">Run</button>
    <button onClick={onStep} className="bg-yellow-500 text-white px-3 py-1 rounded">Step</button>
    <button onClick={onStop} className="bg-red-600 text-white px-3 py-1 rounded">Stop</button>
    <div className="flex-1">
      <div className="w-full bg-gray-200 h-2 rounded">
        <div className="bg-blue-600 h-2 rounded" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
    </div>
    <span className="text-sm">{progress} tokens</span>
  </div>
);

export default TestBar;
