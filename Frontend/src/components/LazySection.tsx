import { Component, Suspense, lazy, useState, type ComponentType, type ReactNode } from 'react';

class LoadBoundary extends Component<{ label: string; onRetry: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div role="alert" className="error">
      <p>Unable to load {this.props.label}. Please retry.</p>
      <button className="secondary" onClick={() => { this.props.onRetry(); this.setState({ failed: false }); }}>Retry loading {this.props.label}</button>
    </div>;
    return this.props.children;
  }
}

// Each section owns its loading/error boundary. A failed screen download must
// leave the workspace, cart, recovery state and navigation mounted. A retry
// creates a fresh lazy instance because React caches rejected lazy promises.
export function lazySection<Props extends object>(load: () => Promise<{ default: ComponentType<Props> }>, label: string) {
  return function LazySection(props: Props) {
    const [Section, setSection] = useState(() => lazy(load));
    return <LoadBoundary label={label} onRetry={() => setSection(() => lazy(load))}>
      <Suspense fallback={<p role="status">Loading {label}…</p>}><Section {...props} /></Suspense>
    </LoadBoundary>;
  };
}
