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
