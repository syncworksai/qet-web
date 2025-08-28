// src/lib/watchlist.js
import axios from "axios";
const BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function authHeader(){
  const token = localStorage.getItem("access");
  return { Authorization: `Bearer ${token}` };
}

export async function fetchWatchlists(){
  const res = await axios.get(`${BASE}/api/watchlists/`, { headers: authHeader() });
  return res.data;
}

export async function createWatchlist(name){
  const res = await axios.post(`${BASE}/api/watchlists/`, { name }, { headers: authHeader() });
  return res.data;
}

export async function addItem(watchlistId, symbol, asset_type="stock"){
  const res = await axios.post(
    `${BASE}/api/watchlists/${watchlistId}/items/`,
    { symbol, asset_type },
    { headers: authHeader() }
  );
  return res.data;
}

export async function deleteItem(watchlistId, itemId){
  const res = await axios.delete(
    `${BASE}/api/watchlists/${watchlistId}/items/${itemId}/`,
    { headers: authHeader() }
  );
  return res.data;
}
