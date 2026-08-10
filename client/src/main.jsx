import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import App from "./App"
import "./index.css"
import { useAuthStore } from "./store/authStore"

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

useAuthStore.getState().init()

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)