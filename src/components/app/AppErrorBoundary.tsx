import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error?: Error;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ArcNest render failed", error, errorInfo);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="app-shell">
        <main className="mobile-frame screen-pad">
          <section className="glass-card rounded-[22px] p-5">
            <p className="text-sm font-semibold text-[var(--danger)]">ArcNest could not start</p>
            <h1 className="mt-2 font-display text-2xl font-bold">App startup error</h1>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Clear site data or reload. If this keeps happening, redeploy the latest build and check the browser console.
            </p>
            <pre className="mt-4 max-h-52 overflow-auto rounded-[18px] border border-[var(--border-soft)] bg-[var(--row-bg)] p-3 text-xs text-[var(--text-secondary)]">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              className="focus-ring mt-4 h-12 w-full rounded-[18px] border border-[var(--border-strong)] bg-[var(--row-bg)] text-sm font-semibold"
              onClick={() => {
                window.localStorage.clear();
                window.location.reload();
              }}
            >
              Clear local data and reload
            </button>
          </section>
        </main>
      </div>
    );
  }
}
