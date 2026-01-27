import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693ff630f364c7fbf1f677cd/fe961bf61_myname.jpg";

const menuItems = [
  { title: "ראשי", url: "/dashboard", icon: LayoutDashboard },
  { title: "הזמנות", url: "/bookings", icon: Calendar },
  { title: "תמונת מצב יומית", url: "/daily-snapshot", icon: CalendarDays },
  { title: "היסטוריית השכרות", url: "/rentals", icon: History },
  { title: "לקוחות", url: "/customers", icon: Users },
  { title: "רכבים", url: "/vehicles", icon: Car },
];

const financeItems = [
  { title: "תזרים מזומנים", url: "/cash-flow", icon: TrendingUp },
  { title: "רווחיות רכבים", url: "/vehicle-financials", icon: CarFront },
  { title: "הכנסות", url: "/incomes", icon: ArrowDownCircle },
  { title: "הוצאות", url: "/expenses", icon: ArrowUpCircle },
];

const taskItems = [
  { title: "תפעול", url: "/maintenance-tasks", icon: Wrench },
  { title: "גבייה", url: "/collection-tasks", icon: DollarSign },
  { title: "כלליות", url: "/general-tasks", icon: ClipboardList },
  { title: "דוחות", url: "/traffic-tickets", icon: Receipt },
  { title: "תאונות", url: "/accidents", icon: AlertTriangle },
];

function AppSidebarContent() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [financeOpen, setFinanceOpen] = useState(
    financeItems.some(item => location.pathname === item.url)
  );
  const [tasksOpen, setTasksOpen] = useState(
    taskItems.some(item => location.pathname === item.url)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const isActive = (url: string) => location.pathname === url;

  return (
    <Sidebar className="border-l-0">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-white">
            <img src={LOGO_URL} alt="Autopo" className="h-full w-full object-cover" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-sidebar-foreground">Autopo CRM</h2>
            <p className="text-xs text-sidebar-foreground/70">ניהול השכרת רכב</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Finance submenu */}
        <SidebarGroup>
          <Collapsible open={financeOpen} onOpenChange={setFinanceOpen}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent">
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span>כספים</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      financeOpen && "rotate-180"
                    )}
                  />
                </div>
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {financeItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink to={item.url} className="flex items-center gap-3 pr-6">
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Tasks submenu */}
        <SidebarGroup>
          <Collapsible open={tasksOpen} onOpenChange={setTasksOpen}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent">
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    <span>משימות</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      tasksOpen && "rotate-180"
                    )}
                  />
                </div>
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {taskItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink to={item.url} className="flex items-center gap-3 pr-6">
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="mb-2 text-sm text-sidebar-foreground/70">
          {profile?.display_name || "משתמש"}
        </div>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          התנתק
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebar() {
  return <AppSidebarContent />;
}

interface MainLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

export function MainLayout({ children, hideSidebar = false }: MainLayoutProps) {
  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
            <SidebarTrigger />
            <span className="font-semibold">Autopo CRM</span>
          </div>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
