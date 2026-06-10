import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UndoProvider } from "@/contexts/UndoContext";
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
import TodayRentals from "@/pages/TodayRentals";
import Vehicles from "@/pages/Vehicles";
import Customers from "@/pages/Customers";
import Bookings from "@/pages/Bookings";
import Rentals from "@/pages/Rentals";
import DailySnapshot from "@/pages/DailySnapshot";
import Incomes from "@/pages/Incomes";
import Expenses from "@/pages/Expenses";
import CashFlow from "@/pages/CashFlow";
import Invoices from "@/pages/Invoices";
import VehicleFinancials from "@/pages/VehicleFinancials";
import MaintenanceTasks from "@/pages/MaintenanceTasks";
import CollectionTasks from "@/pages/CollectionTasks";
import GeneralTasks from "@/pages/GeneralTasks";
import TrafficTickets from "@/pages/TrafficTickets";
import Accidents from "@/pages/Accidents";
import HighwayBills from "@/pages/HighwayBills";
import CalendarView from "@/components/calendar/CalendarView";
import Sign from "@/pages/Sign";
import SignDocument from "@/pages/SignDocument";
import TabletSignatures from "@/pages/TabletSignatures";
import Documents from "@/pages/Documents";
import VehiclePhotos from "@/pages/VehiclePhotos";
import CustomerUpload from "@/pages/CustomerUpload";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <UndoProvider>
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
            <Route path="/rental-station" element={
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
            <Route path="/dashboard" element={<ProtectedRoute requireRole><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
            <Route path="/vehicles" element={<ProtectedRoute requireRole><MainLayout><Vehicles /></MainLayout></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute requireRole><MainLayout><Customers /></MainLayout></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute requireRole><MainLayout><Bookings /></MainLayout></ProtectedRoute>} />
            <Route path="/rentals" element={<ProtectedRoute requireRole><MainLayout><Rentals /></MainLayout></ProtectedRoute>} />
            <Route path="/daily-snapshot" element={<ProtectedRoute requireRole><MainLayout><DailySnapshot /></MainLayout></ProtectedRoute>} />
            <Route path="/incomes" element={<ProtectedRoute requireRole><MainLayout><Incomes /></MainLayout></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute requireRole><MainLayout><Expenses /></MainLayout></ProtectedRoute>} />
            <Route path="/cash-flow" element={<ProtectedRoute requireRole><MainLayout><CashFlow /></MainLayout></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute requireRole><MainLayout><Invoices /></MainLayout></ProtectedRoute>} />
            <Route path="/vehicle-financials" element={<ProtectedRoute requireRole><MainLayout><VehicleFinancials /></MainLayout></ProtectedRoute>} />
            <Route path="/maintenance-tasks" element={<ProtectedRoute requireRole><MainLayout><MaintenanceTasks /></MainLayout></ProtectedRoute>} />
            <Route path="/collection-tasks" element={<ProtectedRoute requireRole><MainLayout><CollectionTasks /></MainLayout></ProtectedRoute>} />
            <Route path="/general-tasks" element={<ProtectedRoute requireRole><MainLayout><GeneralTasks /></MainLayout></ProtectedRoute>} />
            <Route path="/traffic-tickets" element={<ProtectedRoute requireRole><MainLayout><TrafficTickets /></MainLayout></ProtectedRoute>} />
            <Route path="/accidents" element={<ProtectedRoute requireRole><MainLayout><Accidents /></MainLayout></ProtectedRoute>} />
            <Route path="/highway-bills" element={<ProtectedRoute requireRole><MainLayout><HighwayBills /></MainLayout></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute requireRole><MainLayout><Documents /></MainLayout></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute requireRole><MainLayout><CalendarView /></MainLayout></ProtectedRoute>} />

            {/* Public pages */}
            <Route path="/sign" element={<Sign />} />
            <Route path="/sign-document" element={<SignDocument />} />
            <Route path="/tablet-signatures" element={<TabletSignatures />} />
            <Route path="/vehicle-photos" element={<VehiclePhotos />} />
            <Route path="/customer-upload" element={<CustomerUpload />} />
            <Route path="/tablet-signatures" element={<TabletSignatures />} />
            <Route path="/today-rentals" element={
              <ProtectedRoute requireRole>
                <TodayRentals />
              </ProtectedRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </UndoProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
