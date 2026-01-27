import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Calendar } from "lucide-react";
import { formatHebrewDate } from "@/lib/formatters";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693ff630f364c7fbf1f677cd/fe961bf61_myname.jpg";

export default function RentalStation() {
  const navigate = useNavigate();
  const today = new Date();

  return (
    <div className="gradient-station flex min-h-screen flex-col items-center justify-center p-8">
      {/* Logo */}
      <div className="mb-8 h-32 w-32 overflow-hidden rounded-full bg-white shadow-2xl">
        <img
          src={LOGO_URL}
          alt="Autopo Logo"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Title */}
      <h1 className="mb-2 bg-gradient-to-l from-[hsl(227,43%,44%)] to-[hsl(189,75%,41%)] bg-clip-text text-5xl font-bold text-transparent">
        Autopo CRM
      </h1>
      <h2 className="mb-4 text-2xl font-medium text-gray-600">תחנת השכרה</h2>

      {/* Hebrew Date */}
      <div className="mb-12 flex items-center gap-2 text-gray-500">
        <Calendar className="h-5 w-5" />
        <span className="text-lg">{formatHebrewDate(today)}</span>
      </div>

      {/* Action Cards */}
      <div className="grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
        {/* Departures Card */}
        <button
          onClick={() => navigate("/today-departures")}
          className="group gradient-departures station-card-hover flex flex-col items-center rounded-3xl p-12 shadow-xl"
        >
          <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-green-500 shadow-lg transition-transform group-hover:scale-110">
            <ArrowLeft className="h-16 w-16 text-white" />
          </div>
          <h3 className="mb-2 text-3xl font-bold text-green-700">יציאות רכבים</h3>
          <p className="text-center text-gray-600">
            התחלת השכרות והמסירה ללקוחות
          </p>
        </button>

        {/* Returns Card */}
        <button
          onClick={() => navigate("/today-returns")}
          className="group gradient-returns station-card-hover flex flex-col items-center rounded-3xl p-12 shadow-xl"
        >
          <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-blue-500 shadow-lg transition-transform group-hover:scale-110">
            <ArrowRight className="h-16 w-16 text-white" />
          </div>
          <h3 className="mb-2 text-3xl font-bold text-blue-700">החזרות רכבים</h3>
          <p className="text-center text-gray-600">
            סיום השכרות וקבלת רכבים חזרה
          </p>
        </button>
      </div>

      {/* Dashboard Link */}
      <button
        onClick={() => navigate("/dashboard")}
        className="mt-12 text-gray-500 underline-offset-4 hover:text-primary hover:underline"
      >
        כניסה לממשק הניהול המלא
      </button>
    </div>
  );
}
