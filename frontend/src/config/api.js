// Central API configuration.
// To connect the real backend, set VITE_API_BASE_URL in .env and flip
// VITE_USE_MOCK_API to "false" — no UI component needs to change.

const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  useMock: import.meta.env.VITE_USE_MOCK_API !== "false",
  timeout: 0,
};

export default API_CONFIG;