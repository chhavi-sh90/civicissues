const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export async function apiRequest(path, { token, body, headers = {}, ...options } = {}) {
  const requestHeaders = { ...headers };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (body && !(body instanceof FormData)) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: requestHeaders,
    body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessage = Array.isArray(payload.errors)
      ? payload.errors.map((item) => item.message || item).join(" ")
      : "";
    throw new Error(validationMessage || payload.message || "Request failed. Please try again.");
  }

  return payload.data ?? payload;
}
