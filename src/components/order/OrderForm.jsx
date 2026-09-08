import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Search, X, ChevronDown, Calendar, MapPin } from 'lucide-react';

/* ── Searchable Dropdown ──────────────────────── */
function SearchableSelect({ value, options, onChange, placeholder, renderOption, renderSelected, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => (o._searchText || "").toLowerCase().includes(q));
  }, [options, query]);

  const selected = options.find(o => o._id === value);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="searchable-select" ref={ref}>
      <button type="button" className="searchable-select-trigger" onClick={handleOpen} disabled={disabled}>
        {selected ? renderSelected(selected) : <span className="searchable-select-placeholder">{placeholder}</span>}
        <ChevronDown size={16} className="searchable-select-chevron" />
      </button>

      {open && (
        <>
        <div className="searchable-select-backdrop" onClick={() => setOpen(false)} />
        <div className="searchable-select-dropdown">
          <div className="searchable-select-search">
            <Search size={14} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search..."
              autoComplete="off"
            />
            {query && (
              <button type="button" className="searchable-select-clear" onClick={() => setQuery("")}>
                <X size={12} />
              </button>
            )}
          </div>
          <ul className="searchable-select-list">
            {filtered.length === 0 && (
              <li className="searchable-select-empty">No results found</li>
            )}
            {filtered.map(o => (
              <li
                key={o._id}
                className={`searchable-select-option ${o._id === value ? "active" : ""}`}
                onClick={() => { onChange(o._id); setOpen(false); }}
              >
                {renderOption(o)}
              </li>
            ))}
          </ul>
        </div>
        </>
      )}
    </div>
  );
}

/* ── Variant Picker ───────────────────────────── */
function VariantPicker({ variants, selectedId, onSelect }) {
  if (!variants || variants.length === 0) return null;
  return (
    <div className="variant-chips">
      {variants.filter(v => v.isAvailable !== false).map(v => (
        <button
          key={v._id}
          type="button"
          className={`variant-chip ${selectedId === v._id ? "selected" : ""}`}
          onClick={() => onSelect(v._id)}
        >
          <span className="variant-chip-label">{v.label}</span>
          <span className="variant-chip-price">₹{v.discountedPrice ?? v.price}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Address Picker (if customer has multiple) ── */
function AddressPicker({ addresses, onSelect }) {
  if (!addresses || addresses.length <= 1) return null;
  return (
    <div className="address-picker">
      {addresses.map((addr, i) => (
        <button
          key={i}
          type="button"
          className="address-chip"
          onClick={() => onSelect(addr)}
        >
          <MapPin size={12} />
          <span>{addr.street}, {addr.city}{addr.pincode ? ` - ${addr.pincode}` : ""}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Main OrderForm ───────────────────────────── */
export default function OrderForm({ form, onChange, products, customers, onSubmit }) {

  const customerOptions = useMemo(() =>
    (customers || []).map(c => ({
      ...c,
      _searchText: `${c.name || ""} ${c.phone || ""} ${c.email || ""}`,
    })),
  [customers]);

  const pickAddress = (addr) => ({
    street: addr?.street || "",
    city: addr?.city || "",
    state: addr?.state || "",
    pincode: addr?.pincode != null ? String(addr.pincode) : "",
  });

  const handleUserChange = (userId) => {
    const user = (customers || []).find(c => c._id === userId);
    onChange({
      userId,
      address: pickAddress(user?.addresses?.[0]),
    });
  };

  const selectedCustomer = (customers || []).find(c => c._id === form.userId);

  const addItem = () => {
    const items = [...(form.items || []), { productId: "", variantId: "", quantity: 1 }];
    onChange({ items });
  };

  const removeItem = (index) => {
    const items = (form.items || []).filter((_, i) => i !== index);
    onChange({ items });
  };

  const updateItem = (index, updates) => {
    const items = [...(form.items || [])];
    items[index] = { ...items[index], ...updates };
    onChange({ items });
  };

  const handleProductChange = (index, productId) => {
    const product = (products || []).find(p => p._id === productId);
    const defaultVariant = product?.variants?.find(v => v.isDefault) || product?.variants?.[0];
    updateItem(index, {
      productId,
      variantId: defaultVariant?._id || "",
    });
  };

  const getItemPrice = (item) => {
    const product = (products || []).find(p => p._id === item.productId);
    if (!product) return 0;
    if (item.variantId && product.variants?.length) {
      const v = product.variants.find(v => v._id === item.variantId);
      if (v) return v.discountedPrice ?? v.price;
    }
    return product.price;
  };

  const totalAmount = (form.items || []).reduce((sum, item) => sum + getItemPrice(item) * (item.quantity || 0), 0);

  return (
    <form id="order-form" onSubmit={onSubmit} className="order-form">

      {/* ── Customer ── */}
      <div className="form-group">
        <label>Customer</label>
        <SearchableSelect
          value={form.userId}
          options={customerOptions}
          onChange={handleUserChange}
          placeholder="Search customer by name or phone..."
          renderOption={(c) => (
            <div className="customer-option">
              <span className="customer-option-name">{c.name}</span>
              {c.phone && <span className="customer-option-phone">{c.phone}</span>}
            </div>
          )}
          renderSelected={(c) => (
            <span className="searchable-select-value">{c.name}{c.phone ? ` · ${c.phone}` : ""}</span>
          )}
        />
      </div>

      {/* ── Order Date ── */}
      <div className="form-group">
        <label><Calendar size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Order Date <span className="form-hint">(leave blank for today)</span></label>
        <input
          type="date"
          value={form.orderDate || ""}
          onChange={(e) => onChange({ orderDate: e.target.value })}
          max={new Date().toISOString().split("T")[0]}
        />
      </div>

      {/* ── Items ── */}
      <div className="form-section">
        <div className="section-header">
          <h3>Items</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
            <Plus size={14} /> Add
          </button>
        </div>

        {(form.items || []).map((item, index) => {
          const product = (products || []).find(p => p._id === item.productId);
          const hasVariants = product?.variants?.length > 0;
          const price = getItemPrice(item);

          return (
            <div key={index} className="item-card">
              <div className="item-card-top">
                <span className="item-badge">{index + 1}</span>
                <select
                  value={item.productId}
                  onChange={(e) => handleProductChange(index, e.target.value)}
                  required
                >
                  <option value="">Select product</option>
                  {(products || []).map(p => (
                    <option key={p._id} value={p._id}>
                      {p.name}{!p.variants?.length ? ` — ₹${p.price}/${p.unit}` : ""}
                    </option>
                  ))}
                </select>
                <button type="button" className="item-remove-btn" onClick={() => removeItem(index)} aria-label="Remove item">
                  <Trash2 size={14} />
                </button>
              </div>

              {hasVariants && (
                <div className="item-card-variants">
                  <VariantPicker
                    variants={product.variants}
                    selectedId={item.variantId}
                    onSelect={(variantId) => updateItem(index, { variantId })}
                  />
                </div>
              )}

              <div className="item-card-bottom">
                <div className="item-qty-group">
                  <label>Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                    placeholder="1"
                    required
                  />
                </div>
                {item.productId && (
                  <span className="item-line-total">₹{(price * (item.quantity || 0)).toFixed(0)}</span>
                )}
              </div>
            </div>
          );
        })}

        {(form.items || []).length === 0 && (
          <p className="form-empty-hint">No items added yet. Tap Add to begin.</p>
        )}

        {totalAmount > 0 && (
          <div className="order-total-bar">
            <span>Total</span>
            <strong>₹{totalAmount.toFixed(2)}</strong>
          </div>
        )}
      </div>

      {/* ── Address ── */}
      <div className="form-section">
        <h3>Delivery Address <span className="form-hint">(optional)</span></h3>

        {selectedCustomer?.addresses?.length > 1 && (
          <AddressPicker
            addresses={selectedCustomer.addresses}
            onSelect={(addr) => onChange({ address: pickAddress(addr) })}
          />
        )}

        <div className="form-group">
          <label>Street</label>
          <input
            value={form.address?.street || ""}
            onChange={(e) => onChange({ address: { ...form.address, street: e.target.value } })}
            placeholder="e.g. 12 Main Road"
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>City</label>
            <input
              value={form.address?.city || ""}
              onChange={(e) => onChange({ address: { ...form.address, city: e.target.value } })}
              placeholder="City"
            />
          </div>
          <div className="form-group">
            <label>Pincode</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.address?.pincode || ""}
              onChange={(e) => onChange({ address: { ...form.address, pincode: e.target.value } })}
              placeholder="000000"
            />
          </div>
        </div>
      </div>

      {/* ── Payment & Status ── */}
      <div className="form-section">
        <h3>Payment & Status</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Method</label>
            <select value={form.paymentMethod} onChange={(e) => onChange({ paymentMethod: e.target.value })}>
              <option value="COD">Cash on Delivery</option>
              <option value="Online">Online</option>
            </select>
          </div>
          <div className="form-group">
            <label>Payment Status</label>
            <select value={form.paymentStatus} onChange={(e) => onChange({ paymentStatus: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Order Status</label>
          <select value={form.orderStatus} onChange={(e) => onChange({ orderStatus: e.target.value })}>
            <option value="placed">Placed</option>
            <option value="confirmed">Confirmed</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

    </form>
  );
}
