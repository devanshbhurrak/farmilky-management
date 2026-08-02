import { Link } from "react-router-dom";
import { ChevronRight, TrendingUp } from "lucide-react";

export default function InfoCard({ title, value, icon: Icon, color = "primary", to, trend }) {
  const classes = [
    "panel info-card",
    color !== "primary" ? `info-card--${color}` : "",
    to ? "info-card--clickable" : "",
  ].filter(Boolean).join(" ");

  const inner = (
    <div className="info-card-inner">
      <div className="info-card-body">
        <p className="info-card-label">{title}</p>
        <strong className="info-card-value">{value}</strong>
        {trend != null && (
          <span className="info-card-trend">
            <TrendingUp size={12} strokeWidth={2.5} />
            {trend}%
          </span>
        )}
      </div>
      {Icon && (
        <div className="info-card-icon">
          <Icon size={22} aria-hidden />
        </div>
      )}
      {to && <ChevronRight size={14} className="info-card-chevron" aria-hidden />}
    </div>
  );

  if (to) {
    return <Link to={to} className={classes}>{inner}</Link>;
  }

  return <article className={classes}>{inner}</article>;
}
