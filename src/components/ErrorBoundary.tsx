import { Component, type ErrorInfo, type ReactNode } from 'react';
import { m } from '../i18n';
import Button from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Catches render and lazy-chunk errors so a failure shows a friendly message instead of a blank page. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-xl space-y-4 p-6">
        <h1 className="text-2xl font-extrabold">{m().errorBoundary.title}</h1>
        <p className="text-lg">{m().errorBoundary.body}</p>
        <Button onClick={() => window.location.reload()}>{m().errorBoundary.reload}</Button>
      </div>
    );
  }
}
