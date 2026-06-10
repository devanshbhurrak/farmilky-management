import { Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success("Signed in to the admin portal.");
      if (user.role === "delivery_partner" || user.role === "delivery") {
        navigate("/deliveries", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      toast.error(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-header">
          <span className="brand-mark">Farmilky</span>
          <p className="eyebrow">Operations Portal</p>
        </div>

        <div className="form-group">
          <label>Email Address</label>
          <div className="input-with-icon">
            <Mail size={18} className="input-icon" />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="name@farmilky.com"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Password</label>
          <div className="input-with-icon">
            <Lock size={18} className="input-icon" />
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <button className="primary-button" type="submit" disabled={loading} style={{ width: "100%", marginTop: "var(--space-4)", height: "52px", fontSize: "1.1rem" }}>
          {loading ? (
            <Loader2 size={20} className="spin-icon" />
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </div>
  );
}

