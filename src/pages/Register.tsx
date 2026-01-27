import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, UserPlus } from "lucide-react";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693ff630f364c7fbf1f677cd/fe961bf61_myname.jpg";

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "שגיאה",
        description: "הסיסמאות לא תואמות",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "שגיאה",
        description: "הסיסמה חייבת להכיל לפחות 6 תווים",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(email, password, displayName);

    if (error) {
      toast({
        title: "שגיאה בהרשמה",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "נרשמת בהצלחה",
        description: "פנה למנהל המערכת להקצאת הרשאות",
      });
      navigate("/login");
    }

    setIsLoading(false);
  };

  return (
    <div className="gradient-station flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full bg-white shadow-lg">
            <img
              src={LOGO_URL}
              alt="Autopo Logo"
              className="h-full w-full object-cover"
            />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">הרשמה</CardTitle>
          <CardDescription>צור חשבון חדש במערכת Autopo CRM</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">שם מלא</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="ישראל ישראלי"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-left"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 text-left"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אימות סיסמה</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="text-left"
                dir="ltr"
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={isLoading}>
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  הרשם
                </>
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            יש לך חשבון?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              התחבר כאן
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
