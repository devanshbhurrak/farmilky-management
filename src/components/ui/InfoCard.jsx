export default function InfoCard({ title, value, icon: Icon, color = "primary" }) {
  return (
    <article className={`panel info-card${color !== "primary" ? ` info-card--${color}` : ""}`}>
      <div className="info-card-inner">
        {Icon && (
          <div className="info-card-icon">
            <Icon size={20} />
          </div>
        )}
        <div>
          <p className="info-card-label">{title}</p>
          <strong className="info-card-value">{value}</strong>
        </div>
      </div>
    </article>
  );
}
