import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute() {
  const { session, loading, profileLoading, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Wait for profile to load before rendering child routes so role-based
  // routing doesn't flash the wrong page or redirect incorrectly.
  if (profileLoading || (!profile && session)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return <Outlet />;
}
