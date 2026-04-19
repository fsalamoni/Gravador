'use client';

import { ErrorBoundary } from '@/components/error-boundary';
import * as Tabs from '@radix-ui/react-tabs';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ActionsView } from './actions';
import { ChaptersView } from './chapters';
import { ChatView } from './chat';
import { FlashcardsView } from './flashcards';
import { MindmapView } from './mindmap';
import { QuotesView } from './quotes';
import { SentimentView } from './sentiment';
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
      <Tabs.List
        className="flex flex-wrap gap-2 rounded-[24px] border border-border bg-bg/55 p-2"
        aria-label="Recording content tabs"
      >
        {(
          [
            ['transcript', t('transcript')],
            ['summary', t('summary')],
            ['actions', t('actions')],
            ['mindmap', t('mindmap')],
            ['chapters', t('chapters')],
            ['quotes', t('quotes')],
            ['sentiment', t('sentiment')],
            ['flashcards', t('flashcards')],
            ['chat', t('chat')],
          ] as const
        ).map(([key, label]) => (
          <Tabs.Trigger
            key={key}
            value={key}
            className="rounded-full px-4 py-2.5 text-sm font-medium text-mute transition data-[state=active]:bg-accent data-[state=active]:text-onAccent"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <div className="mt-6">
        <Tabs.Content value="transcript">
          <ErrorBoundary>
            <TranscriptView segments={segments} />
          </ErrorBoundary>
        </Tabs.Content>
        <Tabs.Content value="summary">
          <ErrorBoundary>
            <SummaryView payload={byKind.get('summary')} />
          </ErrorBoundary>
        </Tabs.Content>
        <Tabs.Content value="actions">
          <ErrorBoundary>
            <ActionsView items={actionItems} recordingId={recordingId} />
          </ErrorBoundary>
        </Tabs.Content>
        <Tabs.Content value="mindmap">
          <ErrorBoundary>
            <MindmapView payload={byKind.get('mindmap')} />
          </ErrorBoundary>
        </Tabs.Content>
        <Tabs.Content value="chapters">
          <ErrorBoundary>
            <ChaptersView payload={byKind.get('chapters')} />
          </ErrorBoundary>
        </Tabs.Content>
        <Tabs.Content value="quotes">
          <ErrorBoundary>
            <QuotesView payload={byKind.get('quotes')} />
          </ErrorBoundary>
        </Tabs.Content>
        <Tabs.Content value="sentiment">
          <ErrorBoundary>
            <SentimentView payload={byKind.get('sentiment')} />
          </ErrorBoundary>
        </Tabs.Content>
        <Tabs.Content value="flashcards">
          <ErrorBoundary>
            <FlashcardsView payload={byKind.get('flashcards')} />
          </ErrorBoundary>
        </Tabs.Content>
        <Tabs.Content value="chat">
          <ErrorBoundary>
            <ChatView recordingId={recordingId} />
          </ErrorBoundary>
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
}
