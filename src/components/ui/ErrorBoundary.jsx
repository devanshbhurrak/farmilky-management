import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "100vh",
          padding: "2rem",
          textAlign: "center",
          backgroundColor: "var(--color-background)"
        }}>
          <h1 style={{ color: "var(--color-primary-dark)", marginBottom: "1rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
            An unexpected error occurred. We've been notified and are looking into it.
          </p>
          <button 
            onClick={this.handleRetry}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "var(--color-secondary)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
