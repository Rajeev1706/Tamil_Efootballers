import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import App from "./App"
import "./index.css"
import { useAuthStore } from "./store/authStore"
import api from "./lib/api"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            Infinity, // data never goes stale during a session
      gcTime:               Infinity, // cache never cleared while app is open
      refetchOnWindowFocus: false,    // switching tabs won't refetch
      refetchOnMount:       false,    // navigating back won't refetch if data exists
      refetchOnReconnect:   false,    // reconnecting won't refetch
      retry:                1,
      retryDelay:           5000,
      // Data is only fetched fresh when the user does a hard refresh (F5)
      // because that restarts the JS runtime and wipes the in-memory cache.
    },
  },
})

// Prefetch home page data only after auth is ready
function prefetchHomeData() {
  const token = localStorage.getItem("token")
  if (!token) return // not logged in — skip prefetch

  const prefetch = (key, fn) =>
    queryClient.prefetchQuery({ queryKey: key, queryFn: fn })

  prefetch(["players"],        () => api.get("/players").then(r => r.data))
  prefetch(["teams"],          () => api.get("/teams").then(r => r.data))
  prefetch(["settings"],       () => api.get("/settings").then(r => r.data))
  prefetch(["championship"],   () => api.get("/teams/championship").then(r => r.data))
  prefetch(["league-info"],    () => api.get("/league-info").then(r => r.data))
  prefetch(["season-records"], () => api.get("/teams/season-records").then(r => r.data))
}

useAuthStore.getState().init()

// Start prefetching after a short delay so auth initializes first
setTimeout(prefetchHomeData, 500)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)