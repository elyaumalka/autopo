import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693ff630f364c7fbf1f677cd/fe961bf61_myname.jpg";

export default function RentalStation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Logo and Title */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-white rounded-2xl shadow-2xl flex items-center justify-center p-4">
              <img
                src={LOGO_URL}
                alt="Autopo Logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Autopo CRM
          </h1>
          <p className="text-2xl text-gray-700 font-semibold mb-4">תחנת השכרה</p>

          <div className="inline-block bg-white px-6 py-3 rounded-full shadow-lg">
            <p className="text-lg font-medium text-gray-900">
              {format(new Date(), "EEEE, d MMMM yyyy", { locale: he })}
            </p>
          </div>
        </div>

        {/* Main Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Departures Card */}
          <Card
            onClick={() => navigate("/today-departures")}
            className="p-12 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:scale-105 bg-gradient-to-br from-green-50 to-emerald-50 border-4 border-green-200 hover:border-green-400"
          >
            <div className="text-center space-y-6">
              <div className="w-28 h-28 bg-green-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                <ArrowLeft className="w-16 h-16 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">יציאות רכבים</h2>
              <p className="text-xl text-gray-600">
                התחלת השכרות והמסירה ללקוחות
              </p>
            </div>
          </Card>

          {/* Returns Card */}
          <Card
            onClick={() => navigate("/today-returns")}
            className="p-12 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:scale-105 bg-gradient-to-br from-blue-50 to-cyan-50 border-4 border-blue-200 hover:border-blue-400"
          >
            <div className="text-center space-y-6">
              <div className="w-28 h-28 bg-blue-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                <ArrowRight className="w-16 h-16 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">החזרות רכבים</h2>
              <p className="text-xl text-gray-600">
                סיום השכרות וקבלת רכבים חזרה
              </p>
            </div>
          </Card>
        </div>

        {/* Dashboard Link */}
        <div className="text-center mt-12">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-gray-500 underline-offset-4 hover:text-primary hover:underline text-lg"
          >
            כניסה לממשק הניהול המלא
          </button>
        </div>
      </div>
    </div>
  );
}
