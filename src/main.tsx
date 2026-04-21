import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalLogInterceptors, logSystemEvent } from "@/lib/logging";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    void logSystemEvent({
      action: 'react_render_error',
      entity: 'react',
      details: { message: error.message },
      level: 'error',
      errorMessage: error.message,
      stackTrace: error.stack || null,
      source: 'ErrorBoundary',
    });
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 14, color: '#ff6b6b', background: '#080A10', minHeight: '100vh', wordBreak: 'break-all' }}>
          <h2 style={{ color: '#CFD2D4' }}>Erro React</h2>
          <p>{this.state.error.message}</p>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

installGlobalLogInterceptors();

// Mark app as loaded so the timeout diagnostic in index.html won't fire
(window as any).__appLoaded = true;

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
