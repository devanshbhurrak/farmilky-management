import React from 'react';

export default function CustomerForm({ form, onChange, onSubmit, saving }) {
  return (
    <form id="customer-form" onSubmit={onSubmit} className="product-form-stack">
      <div className="form-group">
        <label>Full Name</label>
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., John Doe"
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="john@example.com"
            required
          />
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="10-digit number"
            required
            pattern="[0-9]{10}"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Password</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => onChange({ password: e.target.value })}
          placeholder="Min 6 characters"
          required={!form._id}
        />
      </div>

      <div className="form-group">
        <label>Role</label>
        <select value={form.role} onChange={(e) => onChange({ role: e.target.value })}>
          <option value="customer">Customer</option>
          <option value="admin">Admin</option>
          <option value="delivery">Delivery Boy</option>
          <option value="delivery_partner">Delivery Partner</option>
          <option value="agent">Agent</option>
        </select>
      </div>

      <div className="form-section">
        <h3>Primary Address</h3>
        <div className="form-group">
          <label>Street</label>
          <input
            value={form.address?.street || ""}
            onChange={(e) => onChange({ address: { ...form.address, street: e.target.value } })}
            placeholder="House no, Street name"
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
              value={form.address?.pincode || ""}
              onChange={(e) => onChange({ address: { ...form.address, pincode: e.target.value } })}
              placeholder="6 digits"
            />
          </div>
        </div>
      </div>

      <div className="form-group checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => onChange({ isActive: e.target.checked })}
          />
          <span>Active User</span>
        </label>
      </div>
    </form>
  );
}
