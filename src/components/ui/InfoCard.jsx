import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function InfoCard({ title, value, icon: Icon, color = "primary", to }) {
  const classes = [
    "panel info-card",
    color !== "primary" ? `info-card--${color}` : "",
    to ? "info-card--clickable" : "",
  ].filter(Boolean).join(" ");

  const inner = (
    <div className="info-card-inner">
      {Icon && (
        <div className="info-card-icon">
          <Icon size={24} />
        </div>
      )}
      <div className="info-card-body">
        <p className="info-card-label">{title}</p>
        <strong className="info-card-value">{value}</strong>
      </div>
      {to && <ChevronRight size={16} className="info-card-chevron" />}
    </div>
  );

  if (to) {
    return <Link to={to} className={classes}>{inner}</Link>;
  }

  return <article className={classes}>{inner}</article>;
}
