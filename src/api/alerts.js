import { api } from "./axios";

export const AlertsAPI = {
  list: () => api.get("/api/alerts/").then(r => r.data),
  create: (payload) => api.post("/api/alerts/", payload).then(r => r.data),
  update: (id, payload) => api.patch(`/api/alerts/${id}/`, payload).then(r => r.data),
  remove: (id) => api.delete(`/api/alerts/${id}/`).then(r => r.data),
  events: () => api.get("/api/alerts/events/").then(r => r.data),
  quote: (symbol, asset_type="stock") => api.get("/api/quote/", { params: { symbol, asset_type } }).then(r => r.data),
};
