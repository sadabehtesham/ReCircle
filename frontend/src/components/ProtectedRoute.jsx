import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="p-8 text-gray-500">Loading…</p>;
  return user ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />;
}
