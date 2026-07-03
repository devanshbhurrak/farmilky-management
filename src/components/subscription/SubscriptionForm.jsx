import React from 'react';

export default function SubscriptionForm({ form, onChange, products, customers, onSubmit, saving }) {
  const selectedProduct = (products || []).find(p => p._id === form.productId);

  const selectedProductVariants = selectedProduct?.variants || [];
  const selectedVariant = selectedProductVariants.length > 0 && form.variantId
    ? selectedProductVariants.find(v => v._id === form.variantId)
    : null;
  const variantDefaultPrice = selectedVariant
    ? (selectedVariant.discountedPrice ?? selectedVariant.price)
    : null;

  function handleProductChange(e) {
    const product = (products || []).find(p => p._id === e.target.value);
    const def = product?.variants?.length > 0
      ? (product.variants.find(v => v.isDefault) || product.variants[0])
      : null;
    onChange({
      productId: e.target.value,
      variantId: def ? def._id : null,
      pricePerUnit: def ? (def.discountedPrice ?? def.price) : (product ? product.price : null),
    });
  }

  function handleVariantChange(e) {
    const variantId = e.target.value || null;
    const variant = variantId ? selectedProductVariants.find(v => v._id === variantId) : null;
    onChange({
      variantId,
      pricePerUnit: variant ? (variant.discountedPrice ?? variant.price) : (selectedProduct?.price ?? null),
    });
  }

  const standardPrice = variantDefaultPrice ?? selectedProduct?.price;
  const isCustomPrice =
    selectedProduct &&
    form.pricePerUnit != null &&
    Number(form.pricePerUnit) !== standardPrice;

  return (
    <form id="subscription-form" onSubmit={onSubmit} className="product-form-stack">
      <div className="form-group">
        <label>Customer</label>
        <select
          value={form.userId}
          onChange={(e) => onChange({ userId: e.target.value })}
          required
        >
          <option value="">Select Customer</option>
          {(customers || []).map(c => (
            <option key={c._id} value={c._id}>{c.name} ({c.phone})</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Product</label>
        <select
          value={form.productId}
          onChange={handleProductChange}
          required
        >
          <option value="">Select Product</option>
          {(products || []).map(p => (
            <option key={p._id} value={p._id}>{p.name} — ₹{p.price}/{p.unit}</option>
          ))}
        </select>
      </div>

      {selectedProductVariants.length > 0 && (
        <div className="form-group">
          <label>Variant</label>
          <select value={form.variantId || ''} onChange={handleVariantChange}>
            {selectedProductVariants.map(v => (
              <option key={v._id} value={v._id}>
                {v.label} — ₹{v.discountedPrice ?? v.price}/{v.unit}{v.discountedPrice != null ? ` (was ₹${v.price})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label>Quantity per Day</label>
          <input
            type="number"
            min="1"
            value={form.quantityPerDay}
            onChange={(e) => onChange({ quantityPerDay: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>
            Price per Unit (₹)
            {isCustomPrice && (
              <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 'bold', color: 'var(--color-warning, #b45309)', background: 'var(--warning-bg, #fef3c7)', borderRadius: '4px', padding: '1px 6px' }}>
                CUSTOM
              </span>
            )}
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.pricePerUnit ?? ''}
            onChange={(e) => onChange({ pricePerUnit: e.target.value !== '' ? Number(e.target.value) : null })}
            placeholder={selectedProduct ? `Default: ₹${standardPrice}` : 'Select a product first'}
          />
          {selectedProduct && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
              {selectedVariant ? `Variant rate: ₹${standardPrice}/${selectedVariant.unit}` : `Standard rate: ₹${standardPrice}/${selectedProduct.unit}`}
              {isCustomPrice && ' — custom rate will override'}
            </span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label>Start Date</label>
        <input
          type="date"
          value={form.startDate}
          min={new Date().toISOString().split("T")[0]}
          onChange={(e) => onChange({ startDate: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label>Delivery Schedule</label>
        <select
          value={form.deliverySchedule}
          onChange={(e) => onChange({ deliverySchedule: e.target.value })}
        >
          <option value="daily">Daily</option>
          <option value="alternate">Alternate Days</option>
          <option value="weekly">Weekly</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {form.deliverySchedule === 'custom' && (
        <div className="form-group">
          <label>Custom Days</label>
          <div className="days-selector">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <label key={day} className="day-chip">
                <input
                  type="checkbox"
                  checked={form.customDays?.includes(day)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...(form.customDays || []), day]
                      : (form.customDays || []).filter(d => d !== day);
                    onChange({ customDays: next });
                  }}
                />
                <span>{day}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
