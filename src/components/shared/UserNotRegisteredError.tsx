import { AlertTriangle } from "lucide-react";

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-md w-full p-8 bg-card rounded-xl shadow-lg border">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100 dark:bg-orange-900/20">
            <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">גישה מוגבלת</h1>
          <p className="text-muted-foreground mb-8">
            אינך רשום לשימוש באפליקציה זו. אנא פנה למנהל המערכת כדי לבקש גישה.
          </p>
          <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground text-right">
            <p>אם אתה מאמין שזו שגיאה, אתה יכול:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>לוודא שאתה מחובר עם החשבון הנכון</li>
              <li>לפנות למנהל המערכת לקבלת גישה</li>
              <li>לנסות להתנתק ולהתחבר מחדש</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
