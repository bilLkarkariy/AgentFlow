import React from 'react';
import { useBlock, useInstallBlock } from '../../entities/block/api';
import type { Block } from '../../shared/types/block';

interface BlockDetailDrawerProps {
  blockId: string | null;
  onClose: () => void;
}

const BlockDetailDrawer: React.FC<BlockDetailDrawerProps> = ({ blockId, onClose }) => {
  const { data: block, isLoading } = useBlock(blockId || '');
  const installMut = useInstallBlock();

  if (!blockId) return null;
  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end">
      <div className="w-80 bg-white h-full p-4">
        <button onClick={onClose} className="float-right">Close</button>
        <h2 className="text-xl font-semibold mb-2">{(block as Block).name}</h2>
        <p className="text-sm mb-4">{(block as Block).description}</p>
        <button
          onClick={() => installMut.mutate((block as Block).id)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Install
        </button>
      </div>
    </div>
  );
};

export default BlockDetailDrawer;
