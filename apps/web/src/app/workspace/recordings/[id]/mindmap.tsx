'use client';

import 'reactflow/dist/style.css';
import { useMemo } from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow';

type MindNode = { id: string; label: string; children: MindNode[]; segmentIds?: string[] };

export function MindmapView({ payload }: { payload: unknown }) {
  const tree = payload as MindNode | undefined;
  const { nodes, edges } = useMemo(() => toFlow(tree), [tree]);

  if (!tree) {
    return <p className="text-mute">Mapa mental em processamento…</p>;
  }

  return (
    <div className="h-[600px] card overflow-hidden">
      <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.3 }}>
        <Background color="#262b3c" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function toFlow(root: MindNode | undefined): { nodes: Node[]; edges: Edge[] } {
  if (!root) return { nodes: [], edges: [] };
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const positions = new Map<string, { x: number; y: number }>();
  const layoutWidth = 260;
  const layoutRowHeight = 90;

  const countLeaves = (n: MindNode): number =>
    n.children.length === 0 ? 1 : n.children.reduce((acc, c) => acc + countLeaves(c), 0);

  const place = (n: MindNode, depth: number, y: number, spanLeaves: number) => {
    const x = depth * layoutWidth;
    const cy = y + (spanLeaves * layoutRowHeight) / 2;
    positions.set(n.id, { x, y: cy });
    nodes.push({
      id: n.id,
      data: { label: n.label },
      position: { x, y: cy },
      style: {
        background: depth === 0 ? '#7c5cff' : '#141824',
        color: depth === 0 ? 'white' : '#e6e8ef',
        border: '1px solid #262b3c',
        borderRadius: 10,
        padding: 8,
        fontSize: 13,
      },
    });
    let cursor = y;
    for (const child of n.children) {
      const leaves = countLeaves(child);
      place(child, depth + 1, cursor, leaves);
      edges.push({
        id: `${n.id}-${child.id}`,
        source: n.id,
        target: child.id,
        style: { stroke: '#3a4058' },
      });
      cursor += leaves * layoutRowHeight;
    }
  };

  place(root, 0, 0, countLeaves(root));
  return { nodes, edges };
}
