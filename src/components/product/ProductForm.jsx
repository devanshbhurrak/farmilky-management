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
        <label>Variants <span style={{fontWeight: 'normal', fontSize: '0.82em', color: '#9ca3af'}}>(optional — define pack sizes with individual prices)</span></label>
        {(form.variants || []).map((v, i) => (
          <div key={i} style={{border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: '#fafafa'}}>
            <div className="form-row" style={{marginBottom: 6}}>
              <div className="form-group" style={{marginBottom: 0}}>
                <label style={{fontSize: '0.78em'}}>Label</label>
                <input
                  placeholder="e.g. 1L, 500ml, 250g"
                  value={v.label}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, label: e.target.value} : x) })}
                />
              </div>
              <div className="form-group" style={{marginBottom: 0}}>
                <label style={{fontSize: '0.78em'}}>Quantity</label>
                <input
                  type="number" min="0" placeholder="e.g. 1, 500"
                  value={v.quantity}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, quantity: e.target.value} : x) })}
                />
              </div>
              <div className="form-group" style={{marginBottom: 0}}>
                <label style={{fontSize: '0.78em'}}>Unit</label>
                <select value={v.unit} onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, unit: e.target.value} : x) })}>
                  {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row" style={{marginBottom: 6}}>
              <div className="form-group" style={{marginBottom: 0}}>
                <label style={{fontSize: '0.78em'}}>Price</label>
                <input
                  type="number" step="0.01" min="0" placeholder="0.00"
                  value={v.price}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, price: e.target.value} : x) })}
                />
              </div>
              <div className="form-group" style={{marginBottom: 0}}>
                <label style={{fontSize: '0.78em'}}>Discounted Price</label>
                <input
                  type="number" step="0.01" min="0" placeholder="Leave blank for no discount"
                  value={v.discountedPrice ?? ''}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, discountedPrice: e.target.value} : x) })}
                />
              </div>
              <div className="form-group" style={{marginBottom: 0}}>
                <label style={{fontSize: '0.78em'}}>Stock</label>
                <input
                  type="number" min="0" placeholder="100"
                  value={v.stock}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, stock: e.target.value} : x) })}
                />
              </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'}}>
              <label className="checkbox-label" style={{fontSize: '0.85em'}}>
                <input
                  type="radio"
                  name="variantDefault"
                  checked={!!v.isDefault}
                  onChange={() => onChange({ variants: (form.variants || []).map((x, j) => ({...x, isDefault: j === i})) })}
                />
                <span>Default</span>
              </label>
              <label className="checkbox-label" style={{fontSize: '0.85em'}}>
                <input
                  type="checkbox"
                  checked={v.isAvailable !== false}
                  onChange={e => onChange({ variants: (form.variants || []).map((x, j) => j === i ? {...x, isAvailable: e.target.checked} : x) })}
                />
                <span>Available</span>
              </label>
              <button
                type="button"
                onClick={() => onChange({ variants: (form.variants || []).filter((_, j) => j !== i) })}
                style={{marginLeft: 'auto', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85em'}}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ variants: [...(form.variants || []), { label: '', quantity: '', unit: 'L', price: '', discountedPrice: null, stock: 100, isDefault: (form.variants || []).length === 0, isAvailable: true }] })}
          style={{marginTop: 4, fontSize: '0.85em', color: '#6366f1', background: 'none', border: '1px dashed #c7d2fe', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', width: '100%'}}
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
