import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import React from "react";

/**
 * Standardized Breadcrumbs component
 * @param {Array<{label: string, path?: string}>} items - List of breadcrumb items
 */
export default function Breadcrumbs({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={index}>
            {item.path ? (
              <Link to={item.path}>{item.label}</Link>
            ) : (
              <span>{item.label}</span>
            )}
            {!isLast && (
              <span className="breadcrumb-separator">
                <ChevronRight size={12} aria-hidden />
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
