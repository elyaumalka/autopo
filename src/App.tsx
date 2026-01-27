import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";

// Auth pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";

// Main pages
import RentalStation from "@/pages/RentalStation";
import Dashboard from "@/pages/Dashboard";
import TodayDepartures from "@/pages/TodayDepartures";
import TodayReturns from "@/pages/TodayReturns";
import Vehicles from "@/pages/Vehicles";
import Customers from "@/pages/Customers";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes without sidebar */}
            <Route path="/" element={
              <ProtectedRoute requireRole>
                <RentalStation />
              </ProtectedRoute>
            } />
            <Route path="/today-departures" element={
              <ProtectedRoute requireRole>
                <TodayDepartures />
              </ProtectedRoute>
            } />
            <Route path="/today-returns" element={
              <ProtectedRoute requireRole>
                <TodayReturns />
              </ProtectedRoute>
            } />

            {/* Protected routes with sidebar */}
            <Route path="/dashboard" element={
              <ProtectedRoute requireRole>
                <MainLayout><Dashboard /></MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/vehicles" element={
              <ProtectedRoute requireRole>
                <MainLayout><Vehicles /></MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/customers" element={
              <ProtectedRoute requireRole>
                <MainLayout><Customers /></MainLayout>
              </ProtectedRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
