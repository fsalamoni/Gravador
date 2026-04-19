'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="rounded-[24px] border border-danger/40 bg-danger/10 px-6 py-8 text-center"
          role="alert"
        >
          <p className="text-sm font-medium text-danger">Algo deu errado ao carregar este conteúdo.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 rounded-full border border-danger/40 px-4 py-2 text-xs font-medium text-danger transition hover:bg-danger/20"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
