import Breadcrumbs from "./Breadcrumbs";

export default function PageHeader({ title, subtitle, actions, breadcrumb, className }) {
  return (
    <div className={className ? `page-header ${className}` : "page-header"}>
      <div className="page-header-left">
        {breadcrumb && (
          Array.isArray(breadcrumb) ? (
            <Breadcrumbs items={breadcrumb} />
          ) : (
            <div className="breadcrumbs">{breadcrumb}</div>
          )
        )}
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-right">{actions}</div>}
    </div>
  );
}
