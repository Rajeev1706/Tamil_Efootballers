import { Navigate } from "react-router-dom"
import { useAuthStore } from "../../store/authStore"
import Loading from "./Loading"

export default function ProtectedRoute({ children, role }) {
  const user = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)

  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  if (role === "admin" && user.role !== "admin") return <Navigate to="/team" replace />
  return children
}