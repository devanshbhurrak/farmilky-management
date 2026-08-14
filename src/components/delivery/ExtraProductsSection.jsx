import { useRef, useState, useEffect } from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
import { formatCurrency } from "../../utils/format";

export function makeEmptyRow() {
  return {
    _tempId: crypto.randomUUID(),
    productId: "",
    name: "",
    quantity: 1,
    price: 0,
    unit: "unit",
    image: "",
    variantId: null,
  };
}

function ExtraProductRow({ row, allProducts, existingProductIds, onUpdate, onRemove, canRemove }) {
  const [searchText, setSearchText] = useState(row.name || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  const filtered = searchText.trim().length > 0
    ? allProducts.filter((p) =>
        p.name.toLowerCase().includes(searchText.trim().toLowerCase())
      ).slice(0, 8)
    : allProducts.slice(0, 8);

  function selectProduct(product) {
    setSearchText(product.name);
    setShowDropdown(false);
    const defaultVariant = product.variants?.find((v) => v.isDefault) || product.variants?.[0];
    const effectivePrice = defaultVariant
      ? (defaultVariant.discountedPrice ?? defaultVariant.price)
      : (product.discountedPrice ?? product.price);
    const effectiveUnit = defaultVariant?.unit || product.unit || "unit";
    // preserve quantity the user may have already typed
    onUpdate({
      productId: String(product._id),
      name: product.name,
      price: effectivePrice,
      unit: effectiveUnit,
      image: product.image,
      variantId: defaultVariant ? String(defaultVariant._id) : null,
      // quantity intentionally NOT overwritten
    });
  }

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isDuplicate = row.productId && existingProductIds.has(row.productId);
  const qty = Number(row.quantity) || 0;
  const price = Number(row.price) || 0;
  const amount = qty * price;

  return (
    <div className="epr-row">

      {/* ── Product search + remove ── */}
      <div className="epr-top">
        <div className="epr-product-selector" ref={wrapperRef}>
          <input
            type="text"
            className="epr-search-input"
            placeholder="Search product..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setShowDropdown(true);
              if (!e.target.value.trim()) {
                onUpdate({ productId: "", name: "", price: 0, unit: "unit", image: "", variantId: null });
              }
            }}
            onFocus={() => setShowDropdown(true)}
            autoComplete="off"
          />
          {showDropdown && filtered.length > 0 && (
            <ul className="epr-dropdown">
              {filtered.map((p) => (
                <li key={p._id} className="epr-dropdown-item" onMouseDown={() => selectProduct(p)}>
                  <span className="epr-dp-name">{p.name}</span>
                  <span className="epr-dp-price">{(() => {
                    const dv = p.variants?.find((v) => v.isDefault) || p.variants?.[0];
                    const ep = dv ? (dv.discountedPrice ?? dv.price) : (p.discountedPrice ?? p.price);
                    const eu = dv?.unit || p.unit || "unit";
                    return `${formatCurrency(ep)} / ${eu}`;
                  })()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {canRemove && (
          <button className="epr-remove-btn" onClick={onRemove} title="Remove" type="button">
            <X size={14} />
          </button>
        )}
      </div>

      {isDuplicate && (
        <div className="epr-duplicate-warning">
          <AlertTriangle size={12} />
          <span>Already in today's delivery</span>
        </div>
      )}

      {/* ── Qty / Price / Amount ── */}
      <div className="epr-fields">
        <label className="epr-field">
          <span>Qty</span>
          <input
            type="number"
            min="1"
            step="1"
            className="epr-input"
            value={row.quantity}
            onChange={(e) => onUpdate({ quantity: e.target.value })}
            onBlur={(e) => {
              const v = parseInt(e.target.value, 10);
              onUpdate({ quantity: (!Number.isInteger(v) || v < 1) ? 1 : v });
            }}
          />
        </label>

        <label className="epr-field">
          <span>Price (₹)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="epr-input"
            value={row.price}
            onChange={(e) => onUpdate({ price: e.target.value })}
            onBlur={(e) => {
              const v = parseFloat(e.target.value);
              onUpdate({ price: (isNaN(v) || v < 0) ? 0 : parseFloat(v.toFixed(2)) });
            }}
          />
        </label>

        <div className="epr-amount">
          <span className="epr-amount-label">Total</span>
          <span className="epr-amount-value">{formatCurrency(amount)}</span>
        </div>
      </div>
    </div>
  );
}

export function validateExtraItems(items) {
  const filled = items.filter((r) => r.productId);
  if (filled.length === 0) return "Add at least one product.";
  for (const row of filled) {
    const qty = Number(row.quantity);
    if (!Number.isInteger(qty) || qty < 1) return `"${row.name || 'Item'}" quantity must be a whole number ≥ 1.`;
    const price = Number(row.price);
    if (isNaN(price) || price < 0) return `"${row.name || 'Item'}" price must be ≥ 0.`;
  }
  return null;
}

export default function ExtraProductsSection({ existingProductIds, extraItems, onChange, allProducts }) {
  function addRow() {
    onChange([...extraItems, makeEmptyRow()]);
  }

  function updateRow(idx, patch) {
    onChange(extraItems.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  function removeRow(idx) {
    const next = extraItems.filter((_, i) => i !== idx);
    // always keep at least one row
    onChange(next.length > 0 ? next : [makeEmptyRow()]);
  }

  return (
    <div className="extra-products-section eps">
      <div className="eps-toolbar">
        <span className="ccd-section-label">Add products</span>
        <button className="btn btn-ghost btn-sm eps-add-btn" onClick={addRow} type="button">
          <Plus size={14} />
          Add another
        </button>
      </div>

      {extraItems.map((row, idx) => (
        <ExtraProductRow
          key={row._tempId}
          row={row}
          allProducts={allProducts}
          existingProductIds={existingProductIds}
          onUpdate={(patch) => updateRow(idx, patch)}
          onRemove={() => removeRow(idx)}
          canRemove={extraItems.length > 1}
        />
      ))}
    </div>
  );
}
