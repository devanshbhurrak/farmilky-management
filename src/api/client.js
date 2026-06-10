const API_BASE = import.meta.env.VITE_BACKEND_BASEURL || "http://localhost:4000";

export async function apiRequest(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  return fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
}

export async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export { API_BASE };
