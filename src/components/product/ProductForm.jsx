import { categoryOptions, unitOptions } from "../../utils/constants";

export default function ProductForm({ form, onChange, onSubmit }) {
  return (
    <form id="product-form" onSubmit={onSubmit} className="product-form-stack">
      <div className="form-group">
        <label>Product Name</label>
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., Pure Buffalo Milk"
          required
        />
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Product benefits and details..."
          rows={3}
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Category</label>
          <select value={form.category} onChange={(e) => onChange({ category: e.target.value })}>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Unit</label>
          <select value={form.unit} onChange={(e) => onChange({ unit: e.target.value })}>
            {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Price</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.price}
            onChange={(e) => onChange({ price: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
        <div className="form-group">
          <label>Stock (optional)</label>
          <input
            type="number"
            value={form.stock}
            onChange={(e) => onChange({ stock: e.target.value })}
            placeholder="Available units"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Fat Content</label>
        <input
          value={form.fatContent}
          onChange={(e) => onChange({ fatContent: e.target.value })}
          placeholder="e.g., 6.5%"
        />
      </div>

      <div className="form-group">
        <label>Image URL</label>
        <input
          value={form.image}
          onChange={(e) => onChange({ image: e.target.value })}
          placeholder="https://..."
          required
        />
      </div>

      <div className="form-group">
        <label>
          Variants <span className="variant-label-hint">(optional — define pack sizes with individual prices)</span>
        </label>
        {(form.variants || []).map((v, i) => (
          <div key={i} className="variant-card">
            <div className="form-row variant-row">
              <div className="form-group variant-form-group">
                <label>Label</label>
                <input
                  placeholder="e.g. 1L, 500ml, 250g"
                  value={v.label}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, label: e.target.value} : x) })}
                />
              </div>
              <div className="form-group variant-form-group">
                <label>Quantity</label>
                <input
                  type="number" min="0" placeholder="e.g. 1, 500"
                  value={v.quantity}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, quantity: e.target.value} : x) })}
                />
              </div>
              <div className="form-group variant-form-group">
                <label>Unit</label>
                <select value={v.unit} onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, unit: e.target.value} : x) })}>
                  {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row variant-row">
              <div className="form-group variant-form-group">
                <label>Price</label>
                <input
                  type="number" step="0.01" min="0" placeholder="0.00"
                  value={v.price}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, price: e.target.value} : x) })}
                />
              </div>
              <div className="form-group variant-form-group">
                <label>Discounted Price</label>
                <input
                  type="number" step="0.01" min="0" placeholder="Leave blank for no discount"
                  value={v.discountedPrice ?? ''}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, discountedPrice: e.target.value} : x) })}
                />
              </div>
              <div className="form-group variant-form-group">
                <label>Stock</label>
                <input
                  type="number" min="0" placeholder="100"
                  value={v.stock}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, stock: e.target.value} : x) })}
                />
              </div>
            </div>
            <div className="variant-actions">
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="variantDefault"
                  checked={!!v.isDefault}
                  onChange={() => onChange({ variants: (form.variants || []).map((x, j) => ({...x, isDefault: j === i})) })}
                />
                <span>Default</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={v.isAvailable !== false}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, isAvailable: e.target.checked} : x) })}
                />
                <span>Available</span>
              </label>
              <button
                type="button"
                className="variant-remove-btn"
                onClick={() => onChange({ variants: (form.variants || []).filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="variant-add-btn"
          onClick={() => onChange({ variants: [...(form.variants || []), { label: '', quantity: '', unit: 'L', price: '', discountedPrice: null, stock: 100, isDefault: (form.variants || []).length === 0, isAvailable: true }] })}
        >
          + Add Variant
        </button>
      </div>

      <div className="form-group checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.isAvailable}
            onChange={(e) => onChange({ isAvailable: e.target.checked })}
          />
          <span>Visible in catalog</span>
        </label>
      </div>
    </form>
  );
}
