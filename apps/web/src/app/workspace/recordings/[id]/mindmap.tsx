'use client';

import 'reactflow/dist/style.css';
import { useMemo } from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow';

type MindNode = { id: string; label: string; children: MindNode[]; segmentIds?: string[] };

export function MindmapView({ payload }: { payload: unknown }) {
  const tree = payload as MindNode | undefined;
  const { nodes, edges } = useMemo(() => toFlow(tree), [tree]);

  if (!tree) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-[#100c09]/45 px-6 py-10 text-center text-mute">
        Mapa mental em processamento…
      </div>
    );
  }

  return (
    <div className="card h-[600px] overflow-hidden p-0">
      <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.3 }}>
        <Background color="#463429" gap={24} />
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
        background: depth === 0 ? '#f38a37' : '#1d1511',
        color: depth === 0 ? '#120d0a' : '#f7efe7',
        border: '1px solid #463429',
        borderRadius: 18,
        padding: 12,
        minWidth: 160,
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
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
        style: { stroke: '#6d5445', strokeWidth: 1.4 },
      });
      cursor += leaves * layoutRowHeight;
    }
  };

  place(root, 0, 0, countLeaves(root));
  return { nodes, edges };
}
