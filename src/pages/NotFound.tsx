import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();
  const pageName = location.pathname.substring(1) || "home";

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-muted">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          {/* 404 Error Code */}
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-muted-foreground/50">404</h1>
            <div className="h-0.5 w-16 bg-border mx-auto"></div>
          </div>
          
          {/* Main Message */}
          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-foreground">
              הדף לא נמצא
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              הדף <span className="font-medium text-foreground">"{pageName}"</span> לא נמצא באפליקציה.
            </p>
          </div>
          
          {/* Admin Note */}
          {user && (
            <div className="mt-8 p-4 bg-warning/10 rounded-lg border border-warning/20">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-warning/20 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm font-medium text-foreground">הערה</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    ייתכן שהדף עדיין לא הוטמע או שהכתובת שגויה.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="pt-4 space-y-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              חזרה לדף הראשי
            </Link>
            
            <p className="text-xs text-muted-foreground">
              או נווט דרך התפריט הצדדי
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
