'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ActionsView } from './actions';
import { ChaptersView } from './chapters';
import { ChatView } from './chat';
import { MindmapView } from './mindmap';
import { SummaryView } from './summary';
import { TranscriptView } from './transcript';

type Output = { kind: string; payload: unknown };

interface ActionItem {
  id: string;
  text: string;
  assignee: string | null;
  dueDate: string | null;
  done: boolean;
}

interface Props {
  recordingId: string;
  transcript: { full_text: string; detected_locale: string | null } | null;
  segments: Array<{
    id: string;
    start_ms: number;
    end_ms: number;
    text: string;
    speaker_id: string | null;
  }>;
  outputs: Output[];
  actionItems: ActionItem[];
}

export function RecordingTabs({ recordingId, transcript, segments, outputs, actionItems }: Props) {
  const t = useTranslations('recording.tabs');
  const [tab, setTab] = useState('transcript');

  const byKind = new Map(outputs.map((o) => [o.kind, o.payload]));

  return (
    <Tabs.Root value={tab} onValueChange={setTab}>
      <Tabs.List className="flex gap-1 border-b border-border">
        {(
          [
            ['transcript', t('transcript')],
            ['summary', t('summary')],
            ['actions', t('actions')],
            ['mindmap', t('mindmap')],
            ['chapters', t('chapters')],
            ['chat', t('chat')],
          ] as const
        ).map(([key, label]) => (
          <Tabs.Trigger
            key={key}
            value={key}
            className="px-4 py-2.5 text-sm text-mute data-[state=active]:text-text data-[state=active]:border-b-2 data-[state=active]:border-accent -mb-px"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <div className="mt-6">
        <Tabs.Content value="transcript">
          <TranscriptView segments={segments} />
        </Tabs.Content>
        <Tabs.Content value="summary">
          <SummaryView payload={byKind.get('summary')} />
        </Tabs.Content>
        <Tabs.Content value="actions">
          <ActionsView items={actionItems} recordingId={recordingId} />
        </Tabs.Content>
        <Tabs.Content value="mindmap">
          <MindmapView payload={byKind.get('mindmap')} />
        </Tabs.Content>
        <Tabs.Content value="chapters">
          <ChaptersView payload={byKind.get('chapters')} />
        </Tabs.Content>
        <Tabs.Content value="chat">
          <ChatView recordingId={recordingId} />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
}
