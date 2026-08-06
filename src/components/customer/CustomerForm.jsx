import { User, Lock, MapPin } from "lucide-react";

export default function CustomerForm({ form, onChange, onSubmit }) {
  return (
    <form id="customer-form" onSubmit={onSubmit} className="form-stack">
      {/* Identity section */}
      <div className="customer-form-section-head">
        <div className="customer-form-section-icon" aria-hidden="true">
          <User size={14} />
        </div>
        <span className="customer-form-section-title">Identity</span>
      </div>

      <div className="form-group">
        <label>Full Name</label>
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., John Doe"
          autoComplete="name"
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
            autoComplete="email"
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
            autoComplete="tel"
            required
            pattern="[0-9]{10}"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Role</label>
          <select value={form.role} onChange={(e) => onChange({ role: e.target.value })}>
            <option value="customer">Customer</option>
            <option value="agent">Delivery Agent</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="form-group customer-form-checkbox-cell">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => onChange({ isActive: e.target.checked })}
            />
            <span>Active User</span>
          </label>
        </div>
      </div>

      {/* Security section */}
      <div className="customer-form-section-head">
        <div className="customer-form-section-icon" aria-hidden="true">
          <Lock size={14} />
        </div>
        <span className="customer-form-section-title">Security</span>
      </div>

      <div className="form-group">
        <label>Password {form._id && <span className="customer-form-optional-hint">(leave blank to keep unchanged)</span>}</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => onChange({ password: e.target.value })}
          placeholder={form._id ? "Leave blank to keep current" : "Min 6 characters"}
          autoComplete="new-password"
          minLength={6}
          required={!form._id}
        />
      </div>

      {/* Address section */}
      <div className="customer-form-section-head">
        <div className="customer-form-section-icon" aria-hidden="true">
          <MapPin size={14} />
        </div>
        <span className="customer-form-section-title">Primary Address</span>
      </div>

      <div className="form-group">
        <label>Street</label>
        <input
          value={form.address?.street || ""}
          onChange={(e) => onChange({ address: { ...form.address, street: e.target.value } })}
          placeholder="House no., Street name"
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
            pattern="[0-9]{6}"
            title="Enter a valid 6-digit pincode"
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Latitude <span className="form-hint">(optional GPS)</span></label>
          <input
            type="number"
            step="any"
            value={form.address?.lat ?? ""}
            onChange={(e) => onChange({ address: { ...form.address, lat: e.target.value !== "" ? parseFloat(e.target.value) : null } })}
            placeholder="e.g. 12.9716"
          />
        </div>
        <div className="form-group">
          <label>Longitude <span className="form-hint">(optional GPS)</span></label>
          <input
            type="number"
            step="any"
            value={form.address?.lng ?? ""}
            onChange={(e) => onChange({ address: { ...form.address, lng: e.target.value !== "" ? parseFloat(e.target.value) : null } })}
            placeholder="e.g. 77.5946"
          />
        </div>
      </div>
    </form>
  );
}
