import React, { useState } from 'react';
import { useBlocks } from '../entities/block/api';
import BlockDetailDrawer from '../components/designer/BlockDetailDrawer';

const BlockMarketplacePage: React.FC = () => {
  const { data: blocks = [], isLoading } = useBlocks();
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

  if (isLoading) return <p>Loading blocks...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Marketplace Blocks</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {blocks.map(block => (
          <div
            key={block.id}
            onClick={() => setSelectedBlock(block.id)}
            className="border p-4 rounded cursor-pointer hover:shadow"
          >
            <h2 className="font-semibold">{block.name}</h2>
            <p className="text-sm text-gray-500">{block.description}</p>
          </div>
        ))}
      </div>
      <BlockDetailDrawer blockId={selectedBlock} onClose={() => setSelectedBlock(null)} />
    </div>
  );
};

export default BlockMarketplacePage;
