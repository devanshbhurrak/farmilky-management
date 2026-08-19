import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronRight, ArrowUp, ArrowDown, Navigation, Save, MapPin, X, ChevronDown, Search,
} from "lucide-react";
import { apiRequest, safeParseJson } from "../api/client";
import { useMediaQuery } from "../hooks/useMediaQuery";
import LoadingScreen from "../components/ui/LoadingScreen";
import PageError from "../components/ui/PageError";
import toast from "react-hot-toast";

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearestNeighborSort(customers) {
  const withCoords = customers.filter((c) => c._lat != null && c._lng != null);
  const withoutCoords = customers.filter((c) => c._lat == null || c._lng == null);
  if (withCoords.length < 2) return customers;

  const visited = new Array(withCoords.length).fill(false);
  const result = [];
  let current = 0;
  visited[current] = true;
  result.push(withCoords[current]);

  for (let i = 1; i < withCoords.length; i++) {
    let nearest = -1;
    let minDist = Infinity;
    const { _lat: lat1, _lng: lng1 } = withCoords[current];
    for (let j = 0; j < withCoords.length; j++) {
      if (visited[j]) continue;
      const { _lat: lat2, _lng: lng2 } = withCoords[j];
      const dist = haversine(lat1, lng1, lat2, lng2);
      if (dist < minDist) { minDist = dist; nearest = j; }
    }
    visited[nearest] = true;
    result.push(withCoords[nearest]);
    current = nearest;
  }

  return [...result, ...withoutCoords];
}

function CustomerRow({ customer, index, total, onMoveUp, onMoveDown, onRemove, isMobile, dragHandleProps }) {
  const addr = customer.addresses?.[0];
  const addrStr = addr
    ? [addr.street, addr.city, addr.pincode].filter(Boolean).join(", ")
    : "No address";
  const hasCoords = addr?.lat != null && addr?.lng != null;

  return (
    <div
      className={`acp-row ${isMobile ? "" : "acp-row-draggable"}`}
      {...dragHandleProps}
    >
      <div className="acp-seq-badge">#{index + 1}</div>

      <div className="acp-row-info">
        <div className="acp-row-name">{customer.name}</div>
        <div className="acp-row-meta">
          <span>{customer.phone}</span>
          <span className="acp-row-addr">
            <MapPin size={11} />
            {addrStr}
          </span>
          {hasCoords && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${addr.lat},${addr.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="acp-gps-badge"
              title="GPS coordinates set"
            >
              <Navigation size={10} /> GPS
            </a>
          )}
        </div>
      </div>

      <div className="acp-row-controls">
        {isMobile ? (
          <>
            <button
              className="icon-button"
              onClick={() => onMoveUp(index)}
              disabled={index === 0}
              title="Move up"
            >
              <ArrowUp size={16} />
            </button>
            <button
              className="icon-button"
              onClick={() => onMoveDown(index)}
              disabled={index === total - 1}
              title="Move down"
            >
              <ArrowDown size={16} />
            </button>
          </>
        ) : null}
        <button className="icon-button danger" onClick={() => onRemove(customer._id)} title="Remove from area">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export default function AreaCustomersPage() {
  const { id: areaId } = useParams();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [area, setArea] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Customer search dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Drag state (desktop)
  const dragIndex = useRef(null);
  // Removed customers pending persistence
  const removedIdsRef = useRef(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [areaRes, custRes] = await Promise.all([
        apiRequest(`/api/areas/${areaId}`),
        apiRequest(`/api/areas/${areaId}/customers`),
      ]);
      if (!areaRes.ok) throw new Error("Area not found.");
      const areaData = await areaRes.json();
      const custData = await custRes.json();
      setArea(areaData.area);
      removedIdsRef.current = new Set();
      // Attach lat/lng as _lat/_lng for nearest-neighbor
      setCustomers(
        (custData.customers || []).map((c) => ({
          ...c,
          _lat: c.addresses?.[0]?.lat ?? null,
          _lng: c.addresses?.[0]?.lng ?? null,
        }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [areaId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load customers into the dropdown: all on open, filtered while typing
  useEffect(() => {
    if (!dropdownOpen) return;
    const q = searchQuery.trim();
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await apiRequest(
          `/api/user/admin/all?role=customer&skipEnrichment=true${q ? `&search=${encodeURIComponent(q)}` : ""}`
        );
        const data = await safeParseJson(res);
        if (!res.ok) throw new Error(data?.message || "Failed to load customers.");
        const all = data?.users || [];
        // Exclude already-listed customers
        const existingIds = new Set(customers.map((c) => c._id));
        setSearchResults(all.filter((u) => !existingIds.has(u._id)));
      } catch {
        toast.error("Failed to load customers.");
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [dropdownOpen, searchQuery, customers]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  function openDropdown() {
    if (dropdownOpen) return;
    setDropdownOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function moveUp(index) {
    if (index === 0) return;
    setCustomers((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setDirty(true);
  }

  function moveDown(index) {
    setCustomers((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setDirty(true);
  }

  function removeCustomer(customerId) {
    setCustomers((prev) => prev.filter((c) => c._id !== customerId));
    removedIdsRef.current.add(customerId);
    setDirty(true);
  }

  function addCustomer(user) {
    setCustomers((prev) => [
      ...prev,
      {
        ...user,
        _lat: user.addresses?.[0]?.lat ?? null,
        _lng: user.addresses?.[0]?.lng ?? null,
      },
    ]);
    removedIdsRef.current.delete(user._id);
    setSearchQuery("");
    setSearchResults([]);
    setDropdownOpen(false);
    setDirty(true);
  }

  function autoSort() {
    setCustomers((prev) => nearestNeighborSort([...prev]));
    setDirty(true);
    toast.success("Sorted by nearest GPS coordinates.");
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        customers: customers.map((c, i) => ({ customerId: c._id, sequence: i + 1 })),
        removedCustomerIds: Array.from(removedIdsRef.current),
      };
      const res = await apiRequest(`/api/areas/${areaId}/customers`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data?.message || "Failed to save.");
      toast.success("Delivery sequence saved.");
      setDirty(false);
      removedIdsRef.current = new Set();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Desktop drag-and-drop handlers
  function onDragStart(index) {
    dragIndex.current = index;
  }

  function onDragOver(e, overIndex) {
    e.preventDefault();
    const fromIndex = dragIndex.current;
    if (fromIndex === null || fromIndex === overIndex) return;
    dragIndex.current = overIndex;
    setCustomers((prev) => {
      const next = [...prev];
      const [dragged] = next.splice(fromIndex, 1);
      next.splice(overIndex, 0, dragged);
      return next;
    });
    setDirty(true);
  }

  function onDragEnd() {
    dragIndex.current = null;
  }

  if (loading) return <LoadingScreen />;
  if (error) return <PageError message={error} onRetry={loadData} />;

  const hasGpsCustomers = customers.some((c) => c._lat != null && c._lng != null);

  return (
    <div className="view-stack acp-page">
      {/* Breadcrumb */}
      <nav className="customer-page-breadcrumb" aria-label="Breadcrumb">
        <Link to="/areas">Areas</Link>
        <ChevronRight size={14} />
        <span className="text-primary">{area?.name} — Delivery Sequence</span>
      </nav>

      {/* Header */}
      <div className="surface acp-header-surface">
        <div className="acp-header-row">
          <div>
            <h2 className="acp-title">{area?.name}</h2>
            <p className="acp-subtitle">
              {customers.length} customer{customers.length !== 1 ? "s" : ""} · drag to reorder
              {isMobile ? " (use arrows)" : " on desktop"}
            </p>
          </div>
          <div className="acp-header-actions">
            {hasGpsCustomers && (
              <button className="btn btn-secondary btn-sm" onClick={autoSort}>
                <Navigation size={14} /> Auto-Sort by GPS
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              <Save size={14} />
              {saving ? "Saving…" : "Save Order"}
            </button>
          </div>
        </div>
      </div>

      {/* Add customer dropdown */}
      <div className="surface acp-search-surface">
        <div className="acp-dropdown" ref={dropdownRef}>
          <div
            className="acp-dropdown-trigger"
            onMouseDown={openDropdown}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
          >
            <Search size={13} className="acp-dropdown-search-icon" />
            <input
              ref={searchInputRef}
              className="acp-dropdown-search-input"
              type="text"
              value={searchQuery}
              onFocus={openDropdown}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                openDropdown();
              }}
              placeholder="Search customers by name or phone…"
              aria-label="Search customers"
            />
            <ChevronDown size={14} className={`acp-dropdown-chevron${dropdownOpen ? " open" : ""}`} />
          </div>
          {dropdownOpen && (
            <div className="acp-dropdown-panel" role="listbox">
              <div className="acp-dropdown-list">
                {searchLoading && <div className="acp-dropdown-hint">Loading customers…</div>}
                {!searchLoading && searchResults.length === 0 && (
                  <div className="acp-dropdown-hint">No customers found.</div>
                )}
                {searchResults.map((u) => (
                  <button
                    key={u._id}
                    className="acp-search-result-item"
                    role="option"
                    onClick={() => addCustomer(u)}
                  >
                    <span className="acp-search-result-name">{u.name}</span>
                    <span className="acp-search-result-meta">{u.phone}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer list */}
      <div className="surface acp-list-surface">
        {customers.length === 0 ? (
          <div className="acp-empty">No customers assigned to this area yet. Search above to add.</div>
        ) : (
          <div className="acp-list">
            {customers.map((customer, index) =>
              isMobile ? (
                <CustomerRow
                  key={customer._id}
                  customer={customer}
                  index={index}
                  total={customers.length}
                  onMoveUp={moveUp}
                  onMoveDown={moveDown}
                  onRemove={removeCustomer}
                  isMobile={true}
                />
              ) : (
                <CustomerRow
                  key={customer._id}
                  customer={customer}
                  index={index}
                  total={customers.length}
                  onMoveUp={moveUp}
                  onMoveDown={moveDown}
                  onRemove={removeCustomer}
                  isMobile={false}
                  dragHandleProps={{
                    draggable: true,
                    onDragStart: () => onDragStart(index),
                    onDragOver: (e) => onDragOver(e, index),
                    onDragEnd,
                    style: { cursor: "grab" },
                  }}
                />
              )
            )}
          </div>
        )}
      </div>

      {dirty && (
        <div className="acp-save-bar">
          <span>Unsaved changes</span>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            {saving ? "Saving…" : "Save Order"}
          </button>
        </div>
      )}
    </div>
  );
}
