import React from 'react';
import { PlayIcon, ForwardIcon, StopIcon, CheckIcon } from '@heroicons/react/24/outline';

interface TestBarProps {
  onSave: () => void;
  onRun: () => void;
  onStep: () => void;
  onStop: () => void;
  progress?: number;
}

const ghost =
  'flex items-center gap-1.5 h-8 px-2.5 text-[13px] font-medium rounded-md text-inkmute hover:text-ink hover:bg-canvas transition-colors';

const TestBar: React.FC<TestBarProps> = ({ onSave, onRun, onStep, onStop, progress = 0 }) => {
  const running = progress > 0;
  return (
    <div className="flex items-center gap-1 px-4 py-2.5 bg-white border-b border-line">
      <button
        onClick={onRun}
        className="flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium rounded-md bg-ink text-white hover:bg-ink/90 transition-colors"
      >
        <PlayIcon className="w-4 h-4" strokeWidth={1.9} />
        Exécuter
      </button>
      <button onClick={onStep} className={ghost}>
        <ForwardIcon className="w-4 h-4" strokeWidth={1.7} />
        Pas à pas
      </button>
      <button onClick={onStop} className={ghost}>
        <StopIcon className="w-4 h-4" strokeWidth={1.7} />
        Arrêter
      </button>
      <div className="w-px h-5 bg-line mx-1.5" />
      <button onClick={onSave} className={ghost}>
        <CheckIcon className="w-4 h-4" strokeWidth={1.9} />
        Enregistrer
      </button>

      <div className="flex-1 flex items-center gap-3 ml-3">
        <div className="flex-1 max-w-sm h-1 rounded-full bg-line overflow-hidden">
          <div
            className="h-full rounded-full bg-live transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={[
              'w-1.5 h-1.5 rounded-full',
              running ? 'bg-live' : 'bg-line',
            ].join(' ')}
          />
          <span className="measure">{progress} jetons</span>
        </div>
      </div>
    </div>
  );
};

export default TestBar;
