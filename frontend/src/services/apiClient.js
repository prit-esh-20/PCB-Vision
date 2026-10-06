import axios from "axios";
import API_CONFIG from "../config/api";

// Shared Axios instance for the real backend. All API service modules
// use this client when API_CONFIG.useMock is false.
const apiClient = axios.create({
  baseURL: API_CONFIG.baseUrl,
  timeout: API_CONFIG.timeout,
  headers: {
    Accept: "application/json",
  },
});

export default apiClient;