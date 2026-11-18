/**
 * ============================================================
 * AMOUR AFFAIRS — Data Hooks with API + Mock Fallback
 * ============================================================
 * Each hook tries the real API first.
 * When the backend is unreachable (local dev), it falls back
 * to mockData.ts so the dashboard stays fully functional.
 * ============================================================
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { getStoredToken } from "@/lib/api";
import {
  bookingsAPI, leadsAPI, clientsAPI, teamAPI,
  packagesAPI, paymentsAPI, settingsAPI,
} from "@/lib/api";
import {
  bookings as mockBookings,
  leads as mockLeads,
  clients as mockClients,
  teamMembers as mockTeam,
  packages as mockPackages,
  invoices as mockInvoices,
  transactions as mockTransactions,
  type Booking, type Lead, type Client, type TeamMember, type Package, type Invoice, type Transaction,
} from "@/data/mockData";
import {
  mapApiBooking, mapApiClient, mapApiTeamMember,
  mapApiPackage, mapApiInvoice, mapApiTransaction,
} from "@/lib/normalize";

// ── Helper: detect if we're in mock mode ──
function isMockMode(): boolean {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
}

// ── Generic hook pattern ──
function useAPIData<T>(
  apiFn: () => Promise<any>,
  extractFn: (res: any) => T,
  fallback: T,
  deps: any[] = []
) {
  const [data, setData] = useState<T>(fallback);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError("");
    if (isMockMode()) {
      setData(fallback);
      setIsLoading(false);
      return;
    }
    try {
      const res = await apiFn();
      setData(extractFn(res));
    } catch (err: any) {
      console.warn("API fetch failed, using mock data:", err.message);
      setData(fallback);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, isLoading, error, refetch, setData };
}

// ── Bookings ──
export function useBookings(status?: string) {
  return useAPIData(
    () => bookingsAPI.list(status),
    (res) => ((res.bookings || []) as Record<string, unknown>[]).map(mapApiBooking) as Booking[],
    mockBookings,
    [status]
  );
}

export function useBookingStats() {
  const fallbackStats = {
    total_bookings: mockBookings.length,
    confirmed: mockBookings.filter(b => b.status === "Confirmed").length,
    pending: mockBookings.filter(b => b.status === "Pending").length,
    completed: mockBookings.filter(b => b.status === "Completed").length,
    total_revenue: mockBookings.reduce((s, b) => s + b.amount, 0),
    collected: mockBookings.reduce((s, b) => s + b.payment.paid, 0),
    outstanding: mockBookings.reduce((s, b) => s + b.payment.due, 0),
    upcoming_30_days: 4,
  };
  return useAPIData(
    () => bookingsAPI.stats(),
    (res) => res.stats as Record<string, any>,
    fallbackStats
  );
}

// ── Leads ──
export function useLeads(params?: { stage?: string; source?: string }) {
  return useAPIData(
    () => leadsAPI.list(params),
    (res) => (res.leads || []) as Lead[],
    mockLeads,
    [params?.stage, params?.source]
  );
}

// ── Clients ──
export function useClients(params?: { type?: string; search?: string }) {
  return useAPIData(
    () => clientsAPI.list(params),
    (res) => ((res.clients || []) as Record<string, unknown>[]).map(mapApiClient) as Client[],
    mockClients,
    [params?.type, params?.search]
  );
}

// ── Team ──
export function useTeam(all = false) {
  return useAPIData(
    () => teamAPI.list(all),
    (res) => ((res.team || []) as Record<string, unknown>[]).map(mapApiTeamMember) as TeamMember[],
    mockTeam,
    [all]
  );
}

// ── Packages ──
export function usePackages(params?: { category?: string; all?: boolean }) {
  return useAPIData(
    () => packagesAPI.list(params),
    (res) => ((res.packages || []) as Record<string, unknown>[]).map(mapApiPackage) as Package[],
    mockPackages,
    [params?.category, params?.all]
  );
}

// ── Invoices ──
export function useInvoices(status?: string) {
  return useAPIData(
    () => paymentsAPI.invoices.list(status),
    (res) => ((res.invoices || []) as Record<string, unknown>[]).map(mapApiInvoice) as Invoice[],
    mockInvoices,
    [status]
  );
}

// ── Transactions ──
export function useTransactions() {
  return useAPIData(
    () => paymentsAPI.transactions.list(),
    (res) => ((res.transactions || []) as Record<string, unknown>[]).map(mapApiTransaction) as Transaction[],
    mockTransactions
  );
}

// ── Settings ──
export function useSettings(group?: string) {
  return useAPIData(
    () => group ? settingsAPI.getGroup(group) : settingsAPI.getAll(),
    (res) => (res.settings || {}) as Record<string, string>,
    {} as Record<string, string>,
    [group]
  );
}

// ── Payment Stats ──
export function usePaymentStats() {
  const fallbackStats = {
    total_invoiced: mockInvoices.reduce((s, i) => s + i.amount, 0),
    total_collected: mockInvoices.reduce((s, i) => s + i.amountPaid, 0),
    total_outstanding: mockInvoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0),
    overdue_count: mockInvoices.filter(i => i.status === "Overdue").length,
    pending_count: mockInvoices.filter(i => i.status === "Pending").length,
    monthly_revenue: [],
  };
  return useAPIData(
    () => paymentsAPI.stats(),
    (res) => res.stats as Record<string, any>,
    fallbackStats
  );
}
