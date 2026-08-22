import { Loader2, Lock, Mail, Droplets, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.identifier.trim(), form.password);
      if (user.role === "delivery_partner" || user.role === "delivery" || user.role === "agent") {
        toast.success("Signed in.");
        navigate("/agent", { replace: true });
      } else {
        toast.success("Signed in to the admin portal.");
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
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <div className="login-header">
          <span className="login-logo" aria-hidden>
            <Droplets size={28} strokeWidth={2.2} />
          </span>
          <h1 className="brand-mark login-brand">Farmilky</h1>
          <p className="eyebrow">Operations Portal</p>
        </div>

        <div className="form-group">
          <label htmlFor="login-identifier">Email or Phone Number</label>
          <div className="input-wrapper">
            <Mail size={18} className="input-icon" aria-hidden />
            <input
              id="login-identifier"
              type="text"
              value={form.identifier}
              onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
              placeholder="name@farmilky.com or 9876543210"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="login-password">Password</label>
          <div className="input-wrapper">
            <Lock size={18} className="input-icon" aria-hidden />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-toggle-password"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>
          </div>
        </div>

        <button className="btn btn-primary login-submit-btn" type="submit" disabled={loading}>
          {loading ? (
            <Loader2 size={20} className="spin-icon" aria-hidden />
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </div>
  );
}
