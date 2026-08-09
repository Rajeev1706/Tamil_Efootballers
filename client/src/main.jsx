import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import App from "./App"
import "./index.css"
import { useAuthStore } from "./store/authStore"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:   1000 * 60,  // 1 min — don't refetch data that's still fresh
      retry:       1,           // one retry on failure
      retryDelay:  5000,        // wait 5s before retry — gives Render time to finish waking up
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