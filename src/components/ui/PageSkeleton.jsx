import React from "react";
import LoadingSkeleton from "./LoadingSkeleton";

const PageSkeleton = () => {
  return (
    <div style={{ padding: "var(--space-6)" }}>
      <div style={{ marginBottom: "var(--space-8)" }}>
        <LoadingSkeleton width="200px" height="32px" />
        <div style={{ height: "var(--space-2)" }} />
        <LoadingSkeleton width="120px" height="16px" />
      </div>

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", 
        gap: "var(--space-4)",
        marginBottom: "var(--space-8)" 
      }}>
        <LoadingSkeleton height="120px" />
        <LoadingSkeleton height="120px" />
        <LoadingSkeleton height="120px" />
        <LoadingSkeleton height="120px" />
      </div>

      <div>
        <LoadingSkeleton height="400px" />
      </div>
    </div>
  );
};

export default PageSkeleton;
