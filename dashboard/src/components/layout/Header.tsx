"use client";

import { Plus, Mail, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { AddBookingModal } from "@/components/bookings/AddBookingModal";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import type { Booking } from "@/data/mockData";
import { useBookings, useLeads, useClients, useTeam, usePackages } from "@/lib/useData";
import {
  flattenBookings,
  flattenLeads,
  flattenClients,
  flattenTeam,
  flattenPackages,
} from "@/lib/exportUtils";
import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const ROUTE_CONTENT: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Plan, prioritize, and manage your studio bookings." },
  "/bookings": { title: "Bookings", subtitle: "Coordinate and monitor upcoming photographer schedules." },
  "/leads": { title: "Leads", subtitle: "Track, qualify, and convert incoming client inquiries." },
  "/clients": { title: "Clients", subtitle: "Manage your client relationships, histories, and VIP tags." },
  "/team": { title: "Team", subtitle: "Manage photography crew, roles, and current schedules." },
  "/packages": { title: "Packages", subtitle: "Design and optimize shoot bundles and service offerings." },
  "/gallery": { title: "Gallery", subtitle: "Manage client media deliveries and download activities." },
  "/albums": { title: "Albums", subtitle: "Curate the wedding & couple-shoot folders shown on your website." },
  "/premium-albums": { title: "Premium Albums", subtitle: "Showcase your handcrafted album & print collections." },
  "/films": { title: "Films", subtitle: "Manage the wedding films featured across your website." },
  "/website": { title: "Website Content", subtitle: "Edit enquiry copy, session packages, and page text." },
  "/testimonials": { title: "Testimonials", subtitle: "Review client stories and publish quotes." },
  "/faqs": { title: "FAQs", subtitle: "Manage the questions and answers shown on the website." },
  "/guides": { title: "Guides", subtitle: "Publish planning guides and articles to the website." },
  "/case-studies": { title: "Case Studies", subtitle: "Publish real wedding stories to the website." },
  "/lead-magnets": { title: "Lead Magnets", subtitle: "Manage downloadable guides that capture enquiries." },
  "/payments": { title: "Payments", subtitle: "Track invoices, payments status, and gross revenues." },
  "/analytics": { title: "Analytics", subtitle: "Analyze funnel rates, performance, and key metrics." },
  "/settings": { title: "Settings", subtitle: "Configure CRM details, permissions, and app preferences." },
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);

  // `trailingSlash: true` makes pathname "/gallery/" — strip it so the
  // exact-match lookup actually hits (otherwise every page fell back).
  const routeKey = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const content = ROUTE_CONTENT[routeKey] || {
    title: "Amour Affairs",
    subtitle: "Wedding Photography & Studio management CRM."
  };

  useEffect(() => {
    const handleOpen = (e: any) => {
      setBookingToEdit(e.detail?.bookingToEdit || null);
      setIsModalOpen(true);
    };
    window.addEventListener('open-add-booking', handleOpen);
    return () => window.removeEventListener('open-add-booking', handleOpen);
  }, []);

  // Live data for the export (real API when authenticated, mock fallback otherwise)
  const { data: bookingsData, refetch: refetchBookings } = useBookings();
  const { data: leadsData } = useLeads();
  const { data: clientsData } = useClients();
  const { data: teamData } = useTeam(true);
  const { data: packagesData } = usePackages();

  // Build the full dashboard export payload from whatever data is live
  const allDatasets = useMemo(
    () => [
      flattenBookings(bookingsData),
      flattenLeads(leadsData),
      flattenClients(clientsData),
      flattenTeam(teamData),
      flattenPackages(packagesData),
    ],
    [bookingsData, leadsData, clientsData, teamData, packagesData]
  );

  return (
    <>
      <header className="h-[72px] bg-card/60 dark:bg-card/40 backdrop-blur-[120px] rounded-2xl flex items-center justify-between px-8 shrink-0 shadow-sm border-none">
      {/* Left: Dynamic Title + subtitle (Donezo-style animated) */}
      <div className="h-10 flex flex-col justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <h2 className="text-xl font-bold text-foreground leading-tight">{content.title}</h2>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Right: Actions (Sparklink-style) */}
      <div className="flex items-center gap-3">
        {/* Supercharged Global Search Component */}
        <GlobalSearch />

        {/* Add Booking — Sparklink "+New Product" style */}
        <Button 
          onClick={() => window.dispatchEvent(new CustomEvent('open-add-booking'))}
          className="h-10 px-4 flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-[14px] font-semibold shadow-sm transition-colors border-none"
        >
          <Plus className="h-4 w-4" />
          Add Booking
        </Button>

        {/* Export — Full Dashboard Data */}
        <ExportMenu
          datasets={allDatasets}
          filename="amour-affairs-full-export"
          pdfTitle="Full Dashboard Export — All Data"
          variant="header"
        />

        {/* Mail — jumps to the leads inbox */}
        <button
          onClick={() => router.push("/leads")}
          title="Leads inbox"
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-border/50 bg-card/10 hover:bg-card/20 backdrop-blur-md transition-colors"
        >
          <Mail className="h-[18px] w-[18px] text-foreground" strokeWidth={1.7} />
        </button>

        {/* Notification Bell — live lead/enquiry feed */}
        <div className="mr-1">
          <NotificationBell />
        </div>

        {/* Settings — jumps to the studio settings page */}
        <button
          onClick={() => router.push("/settings")}
          title="Settings"
          aria-label="Settings"
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-border/50 bg-card/10 hover:bg-card/20 backdrop-blur-md transition-colors"
        >
          <Settings className="h-[18px] w-[18px] text-foreground" strokeWidth={1.7} />
        </button>

        {/* Theme Toggle replaces User Avatar */}
        <div className="flex items-center pl-3 border-l border-border/50">
          <ThemeToggle />
        </div>
      </div>
      </header>

      <AddBookingModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bookingToEdit={bookingToEdit}
        onSuccess={(newBooking, isEdit) => {
          setIsModalOpen(false);
          // The modal already persisted through the API — tell open pages to
          // update their local lists, and refresh this header's export data.
          window.dispatchEvent(new CustomEvent('booking-synced', { detail: { newBooking, isEdit } }));
          refetchBookings();
        }}
      />
    </>
  );
}
