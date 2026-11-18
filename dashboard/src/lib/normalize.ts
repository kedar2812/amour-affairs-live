/**
 * ============================================================
 * AMOUR AFFAIRS — API row normalizers
 * ============================================================
 * The PHP API returns raw snake_case database rows (client_name,
 * date_start, payment_total…) while the UI components are written
 * against the camelCase shapes in mockData.ts. These mappers turn
 * an API row into the UI shape — decoding HTML entities, coercing
 * numeric strings, and normalising "YYYY-MM-DD HH:MM:SS" dates to
 * ISO — so live data renders exactly like the demo data does.
 * Every mapper also accepts an already-camelCase (mock) object and
 * passes it through untouched, so the same code path serves both.
 * ============================================================
 */

import { decodeEntities } from "@/lib/utils";
import type {
  Booking, Client, TeamMember, Package, Invoice, Transaction,
} from "@/data/mockData";

/* API rows carry the numeric database id needed for PUT/DELETE calls,
   while the UI displays the human ref (#BK-1042). Keep both. */
export type WithDbId<T> = T & { dbId?: number };

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown): string => (v == null ? "" : decodeEntities(String(v)));

/** "2026-07-08 09:00:00" → "2026-07-08T09:00:00" (safe for new Date()). */
const isoDate = (v: unknown): string => {
  if (!v) return "";
  return String(v).replace(" ", "T");
};

const parseMaybeJSON = <T>(v: unknown, fallback: T): T => {
  if (Array.isArray(v) || (typeof v === "object" && v !== null)) return v as T;
  if (typeof v === "string" && v.trim()) {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return fallback;
};

/** Like parseMaybeJSON, but only ever returns an array (a stray "0" or
 *  plain text in a list column must not crash a page with .join/.map). */
const parseMaybeArray = <T>(v: unknown): T[] => {
  const parsed = parseMaybeJSON<unknown>(v, []);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
};

// ── Bookings ──

export function mapApiBooking(row: Record<string, unknown>): WithDbId<Booking> {
  if (row.clientName != null && row.client_name == null) {
    return row as unknown as WithDbId<Booking>; // already UI-shaped (mock)
  }
  const timeline = parseMaybeJSON<Record<string, string | null>>(row.timeline, {});
  const team = parseMaybeArray<unknown>(row.team_assigned);
  return {
    dbId: num(row.id),
    id: str(row.booking_ref) || `#BK-${row.id}`,
    clientId: String(row.client_id ?? ""),
    clientName: str(row.client_name) || "Unnamed client",
    eventType: (str(row.event_type) || "Other") as Booking["eventType"],
    date: isoDate(row.date_start),
    endDate: isoDate(row.date_end) || isoDate(row.date_start),
    venue: str(row.venue),
    city: str(row.city),
    packageId: String(row.package_id ?? ""),
    packageName: str(row.package_name),
    teamAssignedIds: team.map((t) => String(t)),
    amount: num(row.amount),
    status: (str(row.status) || "Pending") as Booking["status"],
    notes: str(row.notes),
    timeline: {
      inquiry: timeline.inquiry ?? null,
      consultation: timeline.consultation ?? null,
      confirmed: timeline.confirmed ?? null,
      shoot: timeline.shoot ?? null,
      editing: timeline.editing ?? null,
      delivered: timeline.delivered ?? null,
    },
    payment: {
      total: num(row.payment_total ?? row.amount),
      paid: num(row.payment_paid),
      due: num(row.payment_due),
    },
  };
}

// ── Clients ──

export function mapApiClient(row: Record<string, unknown>): WithDbId<Client> {
  if (row.totalSpend != null && row.total_spend == null) {
    return row as unknown as WithDbId<Client>;
  }
  return {
    dbId: num(row.id),
    id: String(row.id ?? ""),
    name: str(row.name) || "Unnamed client",
    phone: str(row.phone),
    email: str(row.email),
    whatsapp: str(row.whatsapp) || str(row.phone),
    instagram: str(row.instagram),
    city: str(row.city),
    type: (str(row.type) || "Wedding") as Client["type"],
    totalBookings: num(row.total_bookings ?? row.totalBookings),
    totalSpend: num(row.total_spend ?? row.totalSpend),
    lastShootDate: isoDate(row.last_shoot_date),
    rating: num(row.rating),
    tags: parseMaybeArray<string>(row.tags).map((t) => decodeEntities(String(t))),
    // notes column exists on the API row but not the mock type — keep it.
    ...(row.notes != null ? { notes: str(row.notes) } : {}),
  } as WithDbId<Client>;
}

// ── Team ──

export function mapApiTeamMember(row: Record<string, unknown>): WithDbId<TeamMember> {
  if (row.avatarInitials != null && row.avatar_initials == null) {
    return row as unknown as WithDbId<TeamMember>;
  }
  const name = str(row.name) || "Team member";
  return {
    dbId: num(row.id),
    id: String(row.id ?? ""),
    name,
    role: (str(row.role) || "Photographer") as TeamMember["role"],
    status: (str(row.status) || "Available") as TeamMember["status"],
    currentAssignment: str(row.current_assignment) || undefined,
    skills: parseMaybeArray<string>(row.skills),
    upcomingShootsCount: num(row.upcoming_shoots_count),
    phone: str(row.phone),
    email: str(row.email),
    avatarInitials: str(row.avatar_initials) ||
      name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(),
    joinDate: isoDate(row.join_date),
    bio: str(row.bio),
    equipment: parseMaybeArray<string>(row.equipment),
    rating: num(row.rating),
    onTimeDeliveryRate: num(row.on_time_delivery_rate),
    monthEarnings: num(row.month_earnings),
    // photo_path is used by avatar renderers — pass it through.
    ...(row.photo_path ? { photo_path: String(row.photo_path) } : {}),
  } as WithDbId<TeamMember>;
}

// ── Packages ──

export function mapApiPackage(row: Record<string, unknown>): WithDbId<Package> {
  if (row.isActive != null && row.is_active == null) {
    return row as unknown as WithDbId<Package>;
  }
  return {
    dbId: num(row.id),
    id: String(row.id ?? ""),
    name: str(row.name) || "Untitled package",
    category: (str(row.category) || "Wedding") as Package["category"],
    price: num(row.price),
    description: str(row.description),
    inclusions: parseMaybeArray<string>(row.inclusions).map((i) => decodeEntities(String(i))),
    addons: parseMaybeArray<{ name: string; price: number }>(row.addons)
      .map((a) => ({ name: decodeEntities(String(a?.name ?? "")), price: num(a?.price) })),
    popularity: num(row.popularity),
    bookingsCount: num(row.bookings_count),
    isActive: row.is_active == null ? true : Boolean(Number(row.is_active)),
    requiredRoles: parseMaybeJSON<Package["requiredRoles"]>(row.required_roles, []),
  };
}

// ── Invoices ──

export function mapApiInvoice(row: Record<string, unknown>): WithDbId<Invoice> {
  if (row.amountPaid != null && row.amount_paid == null) {
    return row as unknown as WithDbId<Invoice>;
  }
  return {
    dbId: num(row.id),
    id: str(row.invoice_ref) || `#INV-${row.id}`,
    clientId: String(row.client_id ?? ""),
    clientName: str(row.client_name) || "Unnamed client",
    bookingId: str(row.booking_ref) || String(row.booking_id ?? ""),
    issueDate: isoDate(row.issue_date),
    dueDate: isoDate(row.due_date),
    amount: num(row.amount),
    amountPaid: num(row.amount_paid),
    status: (str(row.status) || "Pending") as Invoice["status"],
    items: parseMaybeJSON<Invoice["items"]>(row.items, []),
  };
}

// ── Transactions ──

export function mapApiTransaction(row: Record<string, unknown>): WithDbId<Transaction> {
  if (row.clientName != null && row.client_name == null) {
    return row as unknown as WithDbId<Transaction>;
  }
  return {
    dbId: num(row.id),
    id: str(row.transaction_ref) || `#TXN-${row.id}`,
    date: isoDate(row.date),
    clientId: String(row.client_id ?? ""),
    clientName: str(row.client_name) || "Unnamed client",
    bookingId: str(row.booking_ref) || String(row.booking_id ?? ""),
    method: (str(row.method) || "UPI") as Transaction["method"],
    amount: num(row.amount),
    notes: str(row.notes),
  };
}
