import axios from "axios";

// This Axios client instance is prepared for future integration with a local FastAPI/Python backend running on the Raspberry Pi.
// Switch the API methods in mockApi.js to use this instance when ready to transition to production hardware.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  timeout: 0,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

export default api;
