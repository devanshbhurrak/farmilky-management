import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function OrderForm({ form, onChange, products, customers, onSubmit, saving }) {
  const handleUserChange = (e) => {
    const userId = e.target.value;
    const user = (customers || []).find(c => c._id === userId);
    onChange({ 
      userId, 
      address: user?.addresses?.[0] || { street: "", city: "", state: "Maharashtra", pincode: "" } 
    });
  };

  const addItem = () => {
    const items = [...(form.items || []), { productId: "", quantity: 1 }];
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

  return (
    <form id="order-form" onSubmit={onSubmit} className="product-form-stack">
      <div className="form-group">
        <label>Customer</label>
        <select value={form.userId} onChange={handleUserChange} required>
          <option value="">Select Customer</option>
          {(customers || []).map(c => (
            <option key={c._id} value={c._id}>{c.name} ({c.phone})</option>
          ))}
        </select>
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Order Items</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
            <Plus size={14} /> Add Item
          </button>
        </div>
        
        {(form.items || []).map((item, index) => (
          <div key={index} className="form-row item-row">
            <div className="form-group flex-2">
              <select 
                value={item.productId} 
                onChange={(e) => updateItem(index, { productId: e.target.value })}
                required
              >
                <option value="">Select Product</option>
                {(products || []).map(p => (
                  <option key={p._id} value={p._id}>{p.name} - {p.price}/{p.unit}</option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1">
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                required
              />
            </div>
            <button type="button" className="btn btn-icon btn-danger" onClick={() => removeItem(index)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="form-section">
        <h3>Delivery Address</h3>
        <div className="form-group">
          <label>Street</label>
          <input
            value={form.address?.street || ""}
            onChange={(e) => onChange({ address: { ...form.address, street: e.target.value } })}
            placeholder="Street address"
            required
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>City</label>
            <input
              value={form.address?.city || ""}
              onChange={(e) => onChange({ address: { ...form.address, city: e.target.value } })}
              placeholder="City"
              required
            />
          </div>
          <div className="form-group">
            <label>Pincode</label>
            <input
              value={form.address?.pincode || ""}
              onChange={(e) => onChange({ address: { ...form.address, pincode: e.target.value } })}
              placeholder="Pincode"
              required
            />
          </div>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Payment Method</label>
          <select value={form.paymentMethod} onChange={(e) => onChange({ paymentMethod: e.target.value })}>
            <option value="COD">Cash on Delivery</option>
            <option value="Online">Online Payment</option>
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
    </form>
  );
}
