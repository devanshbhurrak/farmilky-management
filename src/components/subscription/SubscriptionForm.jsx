import React from 'react';

export default function SubscriptionForm({ form, onChange, products, customers, onSubmit, saving }) {
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
          onChange={(e) => onChange({ productId: e.target.value })}
          required
        >
          <option value="">Select Product</option>
          {(products || []).map(p => (
            <option key={p._id} value={p._id}>{p.name} - {p.price}/{p.unit}</option>
          ))}
        </select>
      </div>

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
          <label>Start Date</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            required
          />
        </div>
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
