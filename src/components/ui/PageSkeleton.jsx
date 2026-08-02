import React from "react";
import LoadingSkeleton from "./LoadingSkeleton";

const PageSkeleton = () => {
  return (
    <div className="page-skeleton" role="status" aria-label="Loading page">
      <div className="page-skeleton-header">
        <LoadingSkeleton width="220px" height="32px" />
        <LoadingSkeleton width="140px" height="16px" />
      </div>

      <div className="page-skeleton-grid">
        {[0, 1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} width="100%" height="110px" />
        ))}
      </div>

      <div className="page-skeleton-body">
        <LoadingSkeleton rows={4} columns={4} />
      </div>
    </div>
  );
};

export default PageSkeleton;
