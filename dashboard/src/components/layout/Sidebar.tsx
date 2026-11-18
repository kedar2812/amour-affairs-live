"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useLeads } from "@/lib/useData";
import {
  LayoutDashboard,
  CalendarDays,
  Contact,
  Users,
  Camera,
  Package,
  CircleDollarSign,
  BarChart3,
  Settings,
  Image,
  FolderOpen,
  BookOpen,
  Film,
  MessageSquareQuote,
  Globe,
  HelpCircle,
  Newspaper,
  Sparkles,
  Gift,
  Heart,
  LogOut,
} from "lucide-react";

const MENU_ITEMS: { name: string; href: string; icon: any; badge?: string }[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Contact },
  { name: "Albums", href: "/albums", icon: FolderOpen },
  { name: "Premium Albums", href: "/premium-albums", icon: BookOpen },
  { name: "Films", href: "/films", icon: Film },
  { name: "Testimonials", href: "/testimonials", icon: MessageSquareQuote },
  { name: "FAQs", href: "/faqs", icon: HelpCircle },
  { name: "Guides", href: "/guides", icon: Newspaper },
  { name: "Case Studies", href: "/case-studies", icon: Sparkles },
  { name: "Lead Magnets", href: "/lead-magnets", icon: Gift },
  { name: "Website", href: "/website", icon: Globe },
  { name: "Team", href: "/team", icon: Camera },
  { name: "Gallery", href: "/gallery", icon: Image },
  { name: "Bookings", href: "/bookings", icon: CalendarDays },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "CRM", href: "/crm", icon: Heart },
  { name: "Packages", href: "/packages", icon: Package },
  { name: "Payments", href: "/payments", icon: CircleDollarSign },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const GENERAL_ITEMS = [
  { name: "Settings", href: "/settings", icon: Settings },
];

// `trailingSlash: true` in next.config makes usePathname() return
// "/albums/", while the hrefs are written without the trailing slash
// ("/albums"). Strip it so the active tab actually matches, and treat
// nested routes (e.g. /albums/123) as keeping their parent active.
const stripSlash = (p: string) => (p !== "/" && p.endsWith("/") ? p.slice(0, -1) : p);
const matchActive = (pathname: string, href: string) => {
  const current = stripSlash(pathname || "/");
  if (href === "/") return current === "/";
  return current === href || current.startsWith(href + "/");
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { data: leads } = useLeads();

  // "New leads" badge: count leads newer than the highest lead id the user has
  // already seen. Opening the Leads page marks everything seen → badge clears.
  const [seenLeadId, setSeenLeadId] = useState(0);
  useEffect(() => {
    setSeenLeadId(Number(localStorage.getItem("leads_seen_max_id") || 0));
  }, []);
  const leadList = (leads as Array<{ id?: number | string }>) || [];
  const maxLeadId = leadList.reduce((m, l) => Math.max(m, Number(l.id) || 0), 0);
  const onLeadsPage = matchActive(pathname, "/leads");
  useEffect(() => {
    if (onLeadsPage && maxLeadId > 0) {
      localStorage.setItem("leads_seen_max_id", String(maxLeadId));
      setSeenLeadId(maxLeadId);
    }
  }, [onLeadsPage, maxLeadId]);
  const newLeadCount = leadList.filter((l) => (Number(l.id) || 0) > seenLeadId).length;

  return (
    <aside className="w-[230px] shrink-0 bg-sidebar h-full flex flex-col border border-border/50 rounded-2xl shadow-sm">
      {/* Brand */}
      <div className="px-5 pt-6 pb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
          <Camera className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-[16px] font-bold text-foreground leading-tight tracking-tight">Amour Affairs</h1>
          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Photography Studio</p>
        </div>
      </div>

      {/* Menu Section */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-[0.12em] px-3 mb-2">Menu</p>
        <div className="space-y-0.5">
          {MENU_ITEMS.map((item) => {
            const isActive = matchActive(pathname, item.href);
            const isNewLeads = item.href === "/leads" && newLeadCount > 0;
            const badge = isNewLeads ? String(newLeadCount) : item.badge;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative flex items-center justify-between px-3 py-2.5 rounded-xl text-[15px] font-medium transition-all duration-200 group z-0 ${
                  isActive
                    ? "text-sidebar-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-sidebar-accent/30 hover:text-foreground"
                }`}
              >
                {/* Active indicator bubble — Sparklink/Donezo sliding style */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-bubble"
                    className="absolute inset-0 bg-sidebar-accent rounded-xl -z-10 border-l-[3px] border-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <div className="flex items-center gap-3">
                  <item.icon
                    className={`h-[18px] w-[18px] ${isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
                    strokeWidth={isActive ? 2 : 1.7}
                  />
                  <span>{item.name}</span>
                </div>
                {badge && (
                  <span className={`text-[11px] min-w-[22px] text-center px-1.5 py-0.5 rounded-full font-bold ${
                    isNewLeads
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isActive
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* General Section */}
        <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-[0.12em] px-3 mt-6 mb-2">General</p>
        <div className="space-y-0.5">
          {GENERAL_ITEMS.map((item) => {
            const isActive = matchActive(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium transition-colors z-0 ${
                  isActive
                    ? "text-sidebar-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-bubble"
                    className="absolute inset-0 bg-sidebar-accent rounded-xl -z-10 border-l-[3px] border-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <item.icon className={`h-[18px] w-[18px] ${isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`} strokeWidth={1.7} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>


      {/* User Profile */}
      <div className="p-5 border-t border-border/50">
        <div className="p-3 bg-sidebar-accent/50 rounded-xl flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-[13px] font-bold text-primary">{user?.name?.substring(0, 2).toUpperCase() || 'AA'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">{user?.name || 'Amour Affairs'}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email || ''}</p>
          </div>
          <button
            onClick={() => logout()}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
