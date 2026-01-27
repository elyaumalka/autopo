import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingPage } from "@/components/shared/LoadingSpinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: boolean;
}

export function ProtectedRoute({ children, requireRole = false }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role is required but user doesn't have one, show pending message
  if (requireRole && !role) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">ממתין לאישור</h1>
          <p className="mt-2 text-muted-foreground">
            החשבון שלך ממתין להקצאת הרשאות על ידי מנהל המערכת.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
