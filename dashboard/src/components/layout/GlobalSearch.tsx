"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search, Phone, Briefcase, User, Loader2, CircleDollarSign, Users, Camera,
  LayoutDashboard, Contact, FolderOpen, BookOpen, Film, MessageSquareQuote,
  HelpCircle, Newspaper, Sparkles, Gift, Globe, Image as ImageIcon, Package,
  CalendarDays, BarChart3, Settings, CornerDownLeft, type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useBookings, useClients, useLeads, useTeam, usePackages } from "@/lib/useData";
import {
  getStoredToken, filmsAPI, testimonialsAPI, faqsAPI, guidesAPI,
  caseStudiesAPI, leadMagnetsAPI, albumsAPI,
} from "@/lib/api";
import { decodeEntities } from "@/lib/utils";

type ResultType =
  | "Page" | "Booking" | "Client" | "Lead" | "Team" | "Package"
  | "Album" | "Film" | "Testimonial" | "FAQ" | "Guide" | "Case Study" | "Lead Magnet";

type SearchResultItem = {
  id: string;
  title: string;
  subtitle: string;
  type: ResultType;
  route: string;
  icon: LucideIcon;
};

// Every navigable page — so the search can jump anywhere in the app.
const PAGES: { name: string; route: string; keywords: string; icon: LucideIcon }[] = [
  { name: "Dashboard", route: "/", keywords: "home overview kpi", icon: LayoutDashboard },
  { name: "Leads", route: "/leads", keywords: "inquiries pipeline enquiries", icon: Contact },
  { name: "Bookings", route: "/bookings", keywords: "shoots calendar kanban schedule", icon: CalendarDays },
  { name: "Clients", route: "/clients", keywords: "customers contacts", icon: Users },
  { name: "Payments", route: "/payments", keywords: "invoices revenue transactions dues money", icon: CircleDollarSign },
  { name: "Analytics", route: "/analytics", keywords: "traffic metrics charts reports", icon: BarChart3 },
  { name: "Team", route: "/team", keywords: "crew photographers staff founder", icon: Camera },
  { name: "Packages", route: "/packages", keywords: "pricing bundles offerings", icon: Package },
  { name: "Gallery", route: "/gallery", keywords: "images photos media", icon: ImageIcon },
  { name: "Albums", route: "/albums", keywords: "wedding couple shoot folders", icon: FolderOpen },
  { name: "Premium Albums", route: "/premium-albums", keywords: "prints collections heirloom", icon: BookOpen },
  { name: "Films", route: "/films", keywords: "videos wedding trailers youtube", icon: Film },
  { name: "Testimonials", route: "/testimonials", keywords: "reviews quotes stories", icon: MessageSquareQuote },
  { name: "FAQs", route: "/faqs", keywords: "questions answers help", icon: HelpCircle },
  { name: "Guides", route: "/guides", keywords: "articles planning blog", icon: Newspaper },
  { name: "Case Studies", route: "/case-studies", keywords: "stories features weddings", icon: Sparkles },
  { name: "Lead Magnets", route: "/lead-magnets", keywords: "downloads pricing guide capture", icon: Gift },
  { name: "Website", route: "/website", keywords: "content copy pages enquiry", icon: Globe },
  { name: "Settings", route: "/settings", keywords: "configuration preferences account", icon: Settings },
];

const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
};

// Best-effort loader for the CMS collections (film/testimonials/faqs/…). These
// aren't loaded app-wide like the core CRM data, so the palette fetches them
// once, the first time it's opened, and caches the result.
type CmsCache = {
  albums: any[]; films: any[]; testimonials: any[]; faqs: any[];
  guides: any[]; caseStudies: any[]; leadMagnets: any[];
};
const EMPTY_CMS: CmsCache = { albums: [], films: [], testimonials: [], faqs: [], guides: [], caseStudies: [], leadMagnets: [] };

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Core CRM data (real API when authenticated, mock fallback otherwise)
  const { data: bookings } = useBookings();
  const { data: clients } = useClients();
  const { data: leads } = useLeads();
  const { data: team } = useTeam(true);
  const { data: packages } = usePackages();

  // CMS collections — lazy loaded on first open.
  const [cms, setCms] = useState<CmsCache>(EMPTY_CMS);
  const [cmsLoaded, setCmsLoaded] = useState(false);
  const [cmsLoading, setCmsLoading] = useState(false);

  const loadCms = useCallback(async () => {
    if (cmsLoaded || cmsLoading || isMockMode()) return;
    setCmsLoading(true);
    const grab = async <T,>(fn: () => Promise<T>, pick: (r: any) => any[]): Promise<any[]> => {
      try { return pick(await fn()) || []; } catch { return []; }
    };
    const [albums, films, testimonials, faqs, guides, caseStudies, leadMagnets] = await Promise.all([
      grab(() => albumsAPI.list({ all: true }), (r) => r.albums),
      grab(() => filmsAPI.list({ all: true }), (r) => r.films),
      grab(() => testimonialsAPI.list({ all: true }), (r) => r.testimonials),
      grab(() => faqsAPI.list(true), (r) => r.faqs),
      grab(() => guidesAPI.list(true), (r) => r.guides),
      grab(() => caseStudiesAPI.list(true), (r) => r.case_studies),
      grab(() => leadMagnetsAPI.list(true), (r) => r.lead_magnets),
    ]);
    setCms({ albums, films, testimonials, faqs, guides, caseStudies, leadMagnets });
    setCmsLoaded(true);
    setCmsLoading(false);
  }, [cmsLoaded, cmsLoading]);

  // Focus shortcut (Cmd/Ctrl+K) — the conventional command-palette binding.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        loadCms();
      }
      if (e.key === "Escape") { setIsOpen(false); inputRef.current?.blur(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loadCms]);

  // Clickaway
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const s = (v: unknown) => (v == null ? "" : decodeEntities(String(v))).toLowerCase();
  const pick = (o: any, ...keys: string[]) => {
    for (const k of keys) if (o?.[k] != null && o[k] !== "") return decodeEntities(String(o[k]));
    return "";
  };

  const results = useMemo<SearchResultItem[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const out: SearchResultItem[] = [];

    // ── Pages (navigate straight there) ──
    PAGES.forEach((p) => {
      if (p.name.toLowerCase().includes(q) || p.keywords.includes(q)) {
        out.push({ id: `page-${p.route}`, title: p.name, subtitle: "Go to page", type: "Page", route: p.route, icon: p.icon });
      }
    });

    // ── Bookings ──
    (bookings as any[]).filter((b) =>
      s(pick(b, "clientName", "client_name")).includes(q) ||
      s(pick(b, "id", "booking_ref")).includes(q) ||
      s(pick(b, "venue")).includes(q) || s(pick(b, "city")).includes(q)
    ).slice(0, 5).forEach((b) => {
      const name = pick(b, "clientName", "client_name") || "Booking";
      const ev = pick(b, "eventType", "event_type");
      out.push({
        id: `b-${pick(b, "id", "booking_ref")}`,
        title: `${name}${ev ? " · " + ev : ""}`,
        subtitle: [pick(b, "id", "booking_ref"), [pick(b, "venue"), pick(b, "city")].filter(Boolean).join(", ")].filter(Boolean).join(" • "),
        type: "Booking", route: `/bookings/?q=${encodeURIComponent(name)}`, icon: Briefcase,
      });
    });

    // ── Clients ──
    (clients as any[]).filter((c) =>
      s(pick(c, "name")).includes(q) || s(pick(c, "email")).includes(q) || s(pick(c, "phone")).includes(q) || s(pick(c, "city")).includes(q)
    ).slice(0, 5).forEach((c) => {
      const name = pick(c, "name") || "Client";
      out.push({
        id: `c-${pick(c, "id")}`, title: name,
        subtitle: [pick(c, "phone"), pick(c, "email")].filter(Boolean).join(" • ") || "Client",
        type: "Client", route: `/clients/?q=${encodeURIComponent(name)}`, icon: User,
      });
    });

    // ── Leads ──
    (leads as any[]).filter((l) =>
      s(pick(l, "clientName", "client_name")).includes(q) ||
      s(pick(l, "phone")).includes(q) || s(pick(l, "stage")).includes(q) || s(pick(l, "lead_ref")).includes(q)
    ).slice(0, 5).forEach((l) => {
      const name = pick(l, "clientName", "client_name") || "New inquiry";
      out.push({
        id: `l-${pick(l, "id", "lead_ref")}`, title: name,
        subtitle: [pick(l, "stage") && `Stage: ${pick(l, "stage")}`, pick(l, "phone")].filter(Boolean).join(" • ") || "Lead",
        type: "Lead", route: `/leads/?q=${encodeURIComponent(name)}`, icon: Phone,
      });
    });

    // ── Team ──
    (team as any[]).filter((t) =>
      s(pick(t, "name")).includes(q) || s(pick(t, "role")).includes(q)
    ).slice(0, 5).forEach((t) => {
      const name = pick(t, "name") || "Team member";
      out.push({
        id: `t-${pick(t, "id")}`, title: name, subtitle: pick(t, "role") || "Team",
        type: "Team", route: `/team/?q=${encodeURIComponent(name)}`, icon: Camera,
      });
    });

    // ── Packages ──
    (packages as any[]).filter((p) =>
      s(pick(p, "name")).includes(q) || s(pick(p, "category")).includes(q)
    ).slice(0, 5).forEach((p) => {
      const name = pick(p, "name") || "Package";
      out.push({
        id: `pk-${pick(p, "id")}`, title: name,
        subtitle: [pick(p, "category"), pick(p, "price") && `₹${Number(pick(p, "price")).toLocaleString("en-IN")}`].filter(Boolean).join(" • ") || "Package",
        type: "Package", route: `/packages/?q=${encodeURIComponent(name)}`, icon: Package,
      });
    });

    // ── CMS content ──
    cms.albums.filter((a) => s(pick(a, "couple")).includes(q) || s(pick(a, "location")).includes(q))
      .slice(0, 4).forEach((a) => out.push({
        id: `al-${a.id}`, title: pick(a, "couple") || "Album",
        subtitle: [pick(a, "location"), pick(a, "date_label")].filter(Boolean).join(" • ") || "Album",
        type: "Album", route: (a.type === "premium" ? "/premium-albums/" : "/albums/") + `?q=${encodeURIComponent(pick(a, "couple"))}`, icon: FolderOpen,
      }));

    cms.films.filter((f) => s(pick(f, "title")).includes(q) || s(pick(f, "caption")).includes(q))
      .slice(0, 4).forEach((f) => out.push({
        id: `fm-${f.id}`, title: pick(f, "title") || "Film",
        subtitle: pick(f, "caption") || "Film", type: "Film",
        route: `/films/?q=${encodeURIComponent(pick(f, "title"))}`, icon: Film,
      }));

    cms.testimonials.filter((t) => s(pick(t, "client_name")).includes(q) || s(pick(t, "review_text")).includes(q))
      .slice(0, 4).forEach((t) => out.push({
        id: `ts-${t.id}`, title: pick(t, "client_name") || "Testimonial",
        subtitle: pick(t, "city") || "Testimonial", type: "Testimonial",
        route: `/testimonials/?q=${encodeURIComponent(pick(t, "client_name"))}`, icon: MessageSquareQuote,
      }));

    cms.faqs.filter((f) => s(pick(f, "question")).includes(q) || s(pick(f, "answer")).includes(q))
      .slice(0, 4).forEach((f) => out.push({
        id: `fq-${f.id}`, title: pick(f, "question") || "FAQ",
        subtitle: pick(f, "category") ? `Category: ${pick(f, "category")}` : "FAQ", type: "FAQ",
        route: `/faqs/?q=${encodeURIComponent(pick(f, "question"))}`, icon: HelpCircle,
      }));

    cms.guides.filter((g) => s(pick(g, "title")).includes(q) || s(pick(g, "excerpt")).includes(q))
      .slice(0, 4).forEach((g) => out.push({
        id: `gd-${g.id}`, title: pick(g, "title") || "Guide",
        subtitle: pick(g, "category") || "Guide", type: "Guide",
        route: `/guides/?q=${encodeURIComponent(pick(g, "title"))}`, icon: Newspaper,
      }));

    cms.caseStudies.filter((c) => s(pick(c, "title")).includes(q) || s(pick(c, "couple")).includes(q) || s(pick(c, "location")).includes(q))
      .slice(0, 4).forEach((c) => out.push({
        id: `cs-${c.id}`, title: pick(c, "title") || pick(c, "couple") || "Case Study",
        subtitle: [pick(c, "couple"), pick(c, "location")].filter(Boolean).join(" • ") || "Case Study", type: "Case Study",
        route: `/case-studies/?q=${encodeURIComponent(pick(c, "title") || pick(c, "couple"))}`, icon: Sparkles,
      }));

    cms.leadMagnets.filter((m) => s(pick(m, "title")).includes(q) || s(pick(m, "description")).includes(q))
      .slice(0, 4).forEach((m) => out.push({
        id: `lm-${m.id}`, title: pick(m, "title") || "Lead Magnet",
        subtitle: "Lead magnet", type: "Lead Magnet",
        route: `/lead-magnets/?q=${encodeURIComponent(pick(m, "title"))}`, icon: Gift,
      }));

    return out;
  }, [query, bookings, clients, leads, team, packages, cms]);

  const go = useCallback((item: SearchResultItem) => {
    setIsOpen(false);
    setQuery("");
    router.push(item.route);
  }, [router]);

  // Keyboard navigation through the flat result list.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[activeIndex]) go(results[activeIndex]); }
  };

  // Preserve a stable, grouped render order while keeping a flat index for keys.
  const GROUP_ORDER: ResultType[] = ["Page", "Booking", "Client", "Lead", "Team", "Package", "Album", "Film", "Testimonial", "FAQ", "Guide", "Case Study", "Lead Magnet"];
  const flatOrder = useMemo(() => {
    const ordered: SearchResultItem[] = [];
    GROUP_ORDER.forEach((g) => results.filter((r) => r.type === g).forEach((r) => ordered.push(r)));
    return ordered;
  }, [results]);

  return (
    <div ref={rootRef} className="relative hidden md:block z-50">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); loadCms(); }}
        onFocus={() => { setIsOpen(true); loadCms(); }}
        onKeyDown={onKeyDown}
        placeholder="Search anything..."
        className="h-10 w-[280px] xl:w-[340px] pl-9 pr-10 bg-muted/50 border border-border/50 rounded-xl text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all shadow-sm"
      />

      {!query && (
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground bg-card border border-border/50 px-1.5 py-0.5 rounded font-mono pointer-events-none shadow-sm">
          ⌘K
        </kbd>
      )}
      {query && (
        <button
          onClick={() => { setQuery(""); inputRef.current?.focus(); }}
          title="Clear"
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-5 w-5 rounded-full hover:bg-muted text-muted-foreground transition-colors text-[13px] leading-none"
        >
          ×
        </button>
      )}

      <AnimatePresence>
        {isOpen && query.trim() !== "" && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 right-0 md:left-0 w-[420px] bg-card/95 backdrop-blur-2xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden pb-1 z-50"
          >
            {flatOrder.length > 0 ? (
              <div className="max-h-[440px] overflow-y-auto custom-scrollbar">
                {GROUP_ORDER.map((groupType) => {
                  const groupItems = results.filter((r) => r.type === groupType);
                  if (groupItems.length === 0) return null;
                  const label = groupType === "Page" ? "Pages"
                    : groupType === "Case Study" ? "Case Studies"
                    : groupType === "FAQ" ? "FAQs"
                    : `${groupType}s`;
                  return (
                    <div key={groupType}>
                      <div className="px-4 py-2 mt-1 sticky top-0 bg-card/95 backdrop-blur-md z-10 border-b border-border/30">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                      </div>
                      <div className="px-2 py-1">
                        {groupItems.map((item) => {
                          const idx = flatOrder.findIndex((r) => r.id === item.id);
                          const isActive = idx === activeIndex;
                          return (
                            <button
                              key={item.id}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onClick={() => go(item)}
                              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${isActive ? "bg-muted" : "hover:bg-muted/50"}`}
                            >
                              <div className={`p-2 rounded-lg shrink-0 transition-colors ${isActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                                <item.icon className="h-4 w-4" />
                              </div>
                              <div className="overflow-hidden flex-1">
                                <p className="text-[14px] font-semibold text-foreground truncate">{item.title}</p>
                                <p className="text-[12px] text-muted-foreground truncate">{item.subtitle}</p>
                              </div>
                              {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : cmsLoading ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-[13px] font-medium">Searching…</span>
              </div>
            ) : (
              <div className="py-8 px-6 text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Search className="h-4 w-4 text-muted-foreground opacity-50" />
                </div>
                <p className="text-[14px] font-semibold text-foreground mb-1">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-[13px] text-muted-foreground">Try a page name, client, booking, lead, package or any content title.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
