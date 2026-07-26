import { create } from "zustand"
import api from "../lib/api"

export const useAuthStore = create((set, get) => ({
  user:  null,
  token: null,
  loading: true,

  setAuth: (user, token) => {
    localStorage.setItem("token", token)
    set({ user, token, loading: false })
  },

  logout: () => {
    localStorage.removeItem("token")
    set({ user: null, token: null, loading: false })
  },

  init: async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      set({ loading: false })
      return
    }

    // Quick check: is the token expired locally?
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem("token")
        set({ loading: false })
        return
      }
    } catch {
      localStorage.removeItem("token")
      set({ loading: false })
      return
    }

    // Verify with backend that token is still valid
    try {
      const res = await api.get("/auth/me")
      set({ user: res.data, token, loading: false })
    } catch {
      localStorage.removeItem("token")
      set({ user: null, token: null, loading: false })
    }
  },
}))