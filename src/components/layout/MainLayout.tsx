import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  History,
  Users,
  Car,
  DollarSign,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardList,
  Wrench,
  Receipt,
  AlertTriangle,
  CarFront,
  LogOut,
  ChevronDown,
  Menu,
  X,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693ff630f364c7fbf1f677cd/fe961bf61_myname.jpg";

const menuItems = [
  { name: "ראשי", page: "/dashboard", icon: LayoutDashboard },
  { name: "הזמנות", page: "/bookings", icon: ClipboardList },
  { name: "לוח שנה", page: "/calendar", icon: CalendarDays },
  { name: "תמונת מצב יומית", page: "/daily-snapshot", icon: Calendar },
  { name: "היסטוריית השכרות", page: "/rentals", icon: FileText },
  { name: "מסמכים חתומים", page: "/documents", icon: FileText },
  { name: "לקוחות", page: "/customers", icon: Users },
  { name: "רכבים", page: "/vehicles", icon: Car },
  { 
    name: "כספים", 
    icon: DollarSign,
    submenu: [
      { name: "תזרים", page: "/cash-flow" },
      { name: "רווחיות רכבים", page: "/vehicle-financials" },
      { name: "הכנסות", page: "/incomes" },
      { name: "הוצאות", page: "/expenses" },
      { name: "כביש 6", page: "/highway-bills" }
    ]
  },
  { 
    name: "משימות", 
    icon: ClipboardList,
    submenu: [
      { name: "תפעול", page: "/maintenance-tasks" },
      { name: "גבייה", page: "/collection-tasks" },
      { name: "כלליות", page: "/general-tasks" }
    ]
  },
  { name: "דוחות", page: "/traffic-tickets", icon: Receipt },
  { name: "תאונות", page: "/accidents", icon: AlertTriangle },
];

interface MainLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

export function MainLayout({ children, hideSidebar = false }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  if (hideSidebar) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const isActive = (page: string) => currentPath === page;
  const hasActiveSubmenu = (submenu: { page: string }[]) => 
    submenu.some(sub => currentPath === sub.page);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#3b50a0] text-white h-16 flex items-center justify-between px-4 shadow-lg">
        <button onClick={() => setSidebarOpen(true)} className="p-2">
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">Autopo CRM</h1>
        <div className="w-10"></div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 right-0 h-full w-72 bg-[#3b50a0] text-white z-50 transform transition-transform duration-300",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 overflow-hidden">
                <img 
                  src={LOGO_URL} 
                  alt="Autopo Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold">Autopo CRM</h1>
                <p className="text-xs text-blue-200">ניהול השכרת רכב</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100%-180px)]">
          {menuItems.map((item) => (
            <div key={item.name}>
              {item.submenu ? (
                <div>
                  <button
                    onClick={() => setExpandedMenu(expandedMenu === item.name ? null : item.name)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all",
                      "hover:bg-white/10",
                      hasActiveSubmenu(item.submenu) ? "bg-[#17a2b8]/20 text-[#17a2b8]" : "text-white/80"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform",
                      expandedMenu === item.name && "rotate-180"
                    )} />
                  </button>
                  {expandedMenu === item.name && (
                    <div className="mr-8 mt-1 space-y-1">
                      {item.submenu.map((sub) => (
                        <Link
                          key={sub.page}
                          to={sub.page}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "block px-4 py-2 rounded-lg transition-all text-sm",
                            isActive(sub.page) ? "bg-[#17a2b8] text-white" : "text-white/70 hover:bg-white/10"
                          )}
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to={item.page}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                    isActive(item.page) 
                      ? "bg-[#17a2b8] text-white shadow-lg shadow-[#17a2b8]/30" 
                      : "text-white/80 hover:bg-white/10"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="mb-2 text-sm text-white/70 px-4">
            {profile?.display_name || "משתמש"}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>התנתקות</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:mr-72 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// Export for compatibility
export function AppSidebar() {
  return null; // Sidebar is now integrated into MainLayout
}
