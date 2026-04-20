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
      <div className="rounded-[28px] border border-dashed border-border bg-bg/45 px-6 py-10 text-center text-mute">
        Mapa mental em processamento…
      </div>
    );
  }

  return (
    <div className="card h-[min(600px,70vh)] overflow-hidden p-0">
      <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.3 }}>
        <Background color="rgb(var(--color-border))" gap={24} />
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
        background: depth === 0 ? 'rgb(var(--color-accent))' : 'rgb(var(--color-surface))',
        color: depth === 0 ? 'rgb(var(--color-onAccent))' : 'rgb(var(--color-text))',
        border: '1px solid rgb(var(--color-border))',
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
        style: { stroke: 'rgb(var(--color-border))', strokeWidth: 1.4 },
      });
      cursor += leaves * layoutRowHeight;
    }
  };

  place(root, 0, 0, countLeaves(root));
  return { nodes, edges };
}
