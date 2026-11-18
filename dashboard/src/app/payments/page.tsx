"use client";

import React, { useState } from 'react';
import { Search, Plus, CheckCircle2, Trash2, Loader2, Receipt, IndianRupee, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Drawer } from '@/components/ui/Drawer';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { flattenInvoices, flattenTransactions } from '@/lib/exportUtils';
import { useInvoices, useTransactions, usePaymentStats } from '@/lib/useData';
import { paymentsAPI, getStoredToken } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { formatINRCompact } from '@/lib/utils';
import { formatISTDate } from '@/lib/datetime';
import type { WithDbId } from '@/lib/normalize';
import { Invoice, Transaction } from '@/data/mockData';

type TabView = "Invoices" | "Transactions" | "Advance Tracker";

const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
};

const inputCls = "w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50";
const labelCls = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block";

const EMPTY_INVOICE = { client_name: "", booking_ref: "", amount: "", amount_paid: "", due_date: "" };
const EMPTY_TXN = { client_name: "", booking_ref: "", amount: "", method: "UPI", date: "", notes: "" };

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<TabView>("Invoices");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: invoices, isLoading: invLoading, refetch: refetchInvoices } = useInvoices();
  const { data: transactions, isLoading: txnLoading, refetch: refetchTransactions } = useTransactions();
  const { data: payStats, refetch: refetchStats } = usePaymentStats();
  const { showToast } = useToast();
  const ps = (payStats || {}) as Record<string, number>;

  // Global search deep link: /payments/?q=priya pre-fills the search box
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearchQuery(q);
  }, []);

  // ── Create Invoice form ──
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invForm, setInvForm] = useState({ ...EMPTY_INVOICE });
  const [invErrors, setInvErrors] = useState<Record<string, string>>({});
  const [invSaving, setInvSaving] = useState(false);

  // ── Record Payment form ──
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnForm, setTxnForm] = useState({ ...EMPTY_TXN });
  const [txnErrors, setTxnErrors] = useState<Record<string, string>>({});
  const [txnSaving, setTxnSaving] = useState(false);

  const validateInvoice = () => {
    const errs: Record<string, string> = {};
    if (!invForm.client_name.trim()) errs.client_name = "Please enter the client's name.";
    const amount = Number(invForm.amount);
    if (!invForm.amount.trim() || !Number.isFinite(amount) || amount <= 0) errs.amount = "Please enter an amount greater than zero.";
    const paid = Number(invForm.amount_paid || 0);
    if (invForm.amount_paid.trim() && (!Number.isFinite(paid) || paid < 0)) errs.amount_paid = "The amount received can't be negative.";
    if (Number.isFinite(amount) && Number.isFinite(paid) && paid > amount) errs.amount_paid = "The amount received can't exceed the invoice amount.";
    setInvErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateInvoice = async () => {
    if (!validateInvoice()) return;
    if (isMockMode()) { showToast("Connect to the live API to create invoices — demo mode is read-only.", "error"); return; }
    setInvSaving(true);
    try {
      const amount = Number(invForm.amount);
      const paid = Number(invForm.amount_paid || 0);
      await paymentsAPI.invoices.create({
        client_name: invForm.client_name.trim(),
        booking_ref: invForm.booking_ref.trim(),
        amount,
        amount_paid: paid,
        status: paid >= amount ? "Paid" : paid > 0 ? "Partially Paid" : "Pending",
        ...(invForm.due_date ? { due_date: invForm.due_date } : {}),
      });
      await Promise.all([refetchInvoices(), refetchStats()]);
      setInvoiceOpen(false);
      setInvForm({ ...EMPTY_INVOICE });
      setInvErrors({});
      showToast("Invoice created.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't create the invoice — please try again.", "error");
    } finally {
      setInvSaving(false);
    }
  };

  const validateTxn = () => {
    const errs: Record<string, string> = {};
    if (!txnForm.client_name.trim()) errs.client_name = "Please enter the client's name.";
    const amount = Number(txnForm.amount);
    if (!txnForm.amount.trim() || !Number.isFinite(amount) || amount <= 0) errs.amount = "Please enter an amount greater than zero.";
    setTxnErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRecordPayment = async () => {
    if (!validateTxn()) return;
    if (isMockMode()) { showToast("Connect to the live API to record payments — demo mode is read-only.", "error"); return; }
    setTxnSaving(true);
    try {
      await paymentsAPI.transactions.create({
        client_name: txnForm.client_name.trim(),
        booking_ref: txnForm.booking_ref.trim(),
        amount: Number(txnForm.amount),
        method: txnForm.method,
        notes: txnForm.notes.trim(),
        ...(txnForm.date ? { date: txnForm.date } : {}),
      });
      await Promise.all([refetchTransactions(), refetchStats()]);
      setTxnOpen(false);
      setTxnForm({ ...EMPTY_TXN });
      setTxnErrors({});
      showToast("Payment recorded.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't record the payment — please try again.", "error");
    } finally {
      setTxnSaving(false);
    }
  };

  const handleMarkPaid = async (inv: Invoice) => {
    const dbId = (inv as WithDbId<Invoice>).dbId;
    if (isMockMode() || !dbId) { showToast("Connect to the live API to update invoices — demo mode is read-only.", "error"); return; }
    try {
      await paymentsAPI.invoices.update(dbId, { amount_paid: inv.amount, status: "Paid" });
      await Promise.all([refetchInvoices(), refetchStats()]);
      showToast(`Invoice ${inv.id} marked as paid.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update the invoice — please try again.", "error");
    }
  };

  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Delete invoice ${inv.id} for ${inv.clientName}? This cannot be undone.`)) return;
    const dbId = (inv as WithDbId<Invoice>).dbId;
    if (isMockMode() || !dbId) { showToast("Connect to the live API to delete invoices — demo mode is read-only.", "error"); return; }
    try {
      await paymentsAPI.invoices.delete(dbId);
      await Promise.all([refetchInvoices(), refetchStats()]);
      showToast(`Invoice ${inv.id} deleted.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete the invoice — please try again.", "error");
    }
  };

  const sq = searchQuery.toLowerCase();
  const filteredInvoices = (invoices as Invoice[]).filter(inv =>
    (inv.clientName || "").toLowerCase().includes(sq) ||
    (inv.id || "").toLowerCase().includes(sq) ||
    (inv.bookingId || "").toLowerCase().includes(sq)
  );

  const filteredTransactions = (transactions as Transaction[]).filter(tx =>
    (tx.clientName || "").toLowerCase().includes(sq) ||
    (tx.bookingId || "").toLowerCase().includes(sq) ||
    (tx.id || "").toLowerCase().includes(sq)
  );

  // Advance Tracker — every invoice with money still due, sorted by due date.
  const advanceInvoices = filteredInvoices
    .filter(inv => inv.amount - inv.amountPaid > 0)
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'Paid': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Partially Paid': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Pending': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Overdue': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const fmtDate = (d: string) =>
    d ? formatISTDate(d, { month: 'short', day: 'numeric', year: 'numeric' }) : "—";

  const EmptyRows = ({ colSpan, loading, message, hint }: { colSpan: number; loading: boolean; message: string; hint: string }) => (
    <tr>
      <td colSpan={colSpan} className="px-6 py-14 text-center">
        {loading ? (
          <Loader2 className="h-6 w-6 text-primary animate-spin inline-block" />
        ) : (
          <>
            <Receipt className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-[14px] font-semibold text-foreground">{message}</p>
            <p className="text-[13px] text-muted-foreground mt-1">{hint}</p>
          </>
        )}
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="dash-h1">Payments</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Track invoices, dues, and revenue.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-[240px] pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <ExportMenu
            datasets={[flattenInvoices(invoices as Invoice[]), flattenTransactions(transactions as Transaction[])]}
            filename="amour-affairs-payments"
            pdfTitle="Payments Export"
            variant="inline"
          />
          <Button
            variant="outline"
            onClick={() => { setTxnErrors({}); setTxnOpen(true); }}
            className="h-10 px-4 rounded-xl border-border/50 bg-card/10"
          >
            <IndianRupee className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
          <Button
            onClick={() => { setInvErrors({}); setInvoiceOpen(true); }}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {[
          { label: "Total Invoiced", val: formatINRCompact(ps.total_invoiced) },
          { label: "Collected", val: formatINRCompact(ps.total_collected) },
          { label: "Outstanding", val: formatINRCompact(ps.total_outstanding), alert: (ps.total_outstanding || 0) > 0 },
          { label: "Overdue Invoices", val: String(ps.overdue_count ?? 0), alert: (ps.overdue_count || 0) > 0 }
        ].map(stat => (
          <div key={stat.label} className="dash-card p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
            <span className={`text-xl font-bold ${stat.alert ? 'text-red-500' : 'text-foreground'}`}>{stat.val}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card/50 border border-border/50 p-1 rounded-xl w-max shrink-0">
        {(["Invoices", "Transactions", "Advance Tracker"] as TabView[]).map(tab => (
           <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="dash-card flex-1 min-h-[400px]">
        {activeTab === "Invoices" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-[12px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Invoice #</th>
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Booking Ref</th>
                  <th className="px-6 py-4 font-semibold">Due Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Amount</th>
                  <th className="px-6 py-4 font-semibold text-right">Balance Due</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 font-mono text-[13px] text-muted-foreground font-semibold">{inv.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/20 text-primary font-bold text-[10px]">{(inv.clientName || "?").substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-[14px] text-foreground">{inv.clientName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-muted-foreground">{inv.bookingId || "—"}</td>
                    <td className="px-6 py-4 text-[13px] text-foreground">{fmtDate(inv.dueDate)}</td>
                    <td className="px-6 py-4 text-[14px] font-bold text-foreground text-right">
                      ₹{inv.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-[14px] font-bold text-right">
                      <span className={inv.amount - inv.amountPaid > 0 ? "text-amber-500" : "text-muted-foreground"}>
                        ₹{(inv.amount - inv.amountPaid).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {inv.amount - inv.amountPaid > 0 && (
                          <Button variant="ghost" size="icon" title="Mark as paid" onClick={() => handleMarkPaid(inv)} className="h-8 w-8 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" title="Delete invoice" onClick={() => handleDeleteInvoice(inv)} className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <EmptyRows
                    colSpan={8} loading={invLoading}
                    message={searchQuery ? `No invoices match "${searchQuery}"` : "No invoices yet"}
                    hint={searchQuery ? "Try a different client name or invoice number." : "Click “Create Invoice” to raise your first invoice."}
                  />
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Transactions" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-[12px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Method</th>
                  <th className="px-6 py-4 font-semibold">Notes</th>
                  <th className="px-6 py-4 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 text-[13px] text-foreground">{fmtDate(tx.date)}</td>
                    <td className="px-6 py-4 font-semibold text-[14px] text-foreground">{tx.clientName}</td>
                    <td className="px-6 py-4 text-[13px] font-medium text-foreground">{tx.method}</td>
                    <td className="px-6 py-4 text-[13px] text-muted-foreground">{tx.notes || "—"}</td>
                    <td className="px-6 py-4 text-[14px] font-bold text-emerald-500 text-right">
                      +₹{tx.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <EmptyRows
                    colSpan={5} loading={txnLoading}
                    message={searchQuery ? `No transactions match "${searchQuery}"` : "No payments recorded yet"}
                    hint={searchQuery ? "Try a different client name." : "Click “Record Payment” whenever money comes in."}
                  />
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Advance Tracker" && (
          <div className="p-6">
            {advanceInvoices.length === 0 ? (
              <div className="py-14 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="text-[14px] font-semibold text-foreground">Nothing outstanding</p>
                <p className="text-[13px] text-muted-foreground mt-1">Every invoice is fully collected. Balances due appear here with their progress.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {advanceInvoices.map(inv => {
                  const pct = inv.amount > 0 ? Math.round((inv.amountPaid / inv.amount) * 100) : 0;
                  return (
                    <div key={inv.id} className="border border-border/50 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-primary/20 text-primary font-bold text-[10px]">{(inv.clientName || "?").substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-foreground truncate">{inv.clientName}</p>
                            <p className="text-[12px] text-muted-foreground">{inv.id} · due {fmtDate(inv.dueDate)}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[14px] font-bold text-amber-500">₹{(inv.amount - inv.amountPaid).toLocaleString('en-IN')} due</p>
                          <p className="text-[12px] text-muted-foreground">of ₹{inv.amount.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[12px] font-semibold text-muted-foreground w-16 text-right">{pct}% paid</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Invoice drawer */}
      <Drawer isOpen={invoiceOpen} onClose={() => setInvoiceOpen(false)} width="440px" title="Create Invoice">
        <div className="p-6 space-y-5">
          <div>
            <label className={labelCls}>Client Name *</label>
            <input value={invForm.client_name} onChange={(e) => setInvForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Priya & Rahul" className={inputCls} />
            {invErrors.client_name && <p className="text-red-500 text-[12px] font-medium mt-1.5">{invErrors.client_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Invoice Amount (₹) *</label>
              <input type="number" min={0} value={invForm.amount} onChange={(e) => setInvForm(f => ({ ...f, amount: e.target.value }))} placeholder="150000" className={inputCls} />
              {invErrors.amount && <p className="text-red-500 text-[12px] font-medium mt-1.5">{invErrors.amount}</p>}
            </div>
            <div>
              <label className={labelCls}>Already Received (₹)</label>
              <input type="number" min={0} value={invForm.amount_paid} onChange={(e) => setInvForm(f => ({ ...f, amount_paid: e.target.value }))} placeholder="0" className={inputCls} />
              {invErrors.amount_paid && <p className="text-red-500 text-[12px] font-medium mt-1.5">{invErrors.amount_paid}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Booking Ref</label>
              <input value={invForm.booking_ref} onChange={(e) => setInvForm(f => ({ ...f, booking_ref: e.target.value }))} placeholder="#BK-1042 (optional)" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" value={invForm.due_date} onChange={(e) => setInvForm(f => ({ ...f, due_date: e.target.value }))} className={inputCls} />
              <p className="text-[11px] text-muted-foreground mt-1">Defaults to 30 days from today.</p>
            </div>
          </div>
          <Button onClick={handleCreateInvoice} disabled={invSaving || !invForm.client_name.trim() || !invForm.amount.trim()} className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold">
            {invSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating...</> : "Create Invoice"}
          </Button>
          {(!invForm.client_name.trim() || !invForm.amount.trim()) && (
            <p className="text-[12px] text-muted-foreground text-center">Enter the client&apos;s name and the invoice amount to continue.</p>
          )}
        </div>
      </Drawer>

      {/* Record Payment drawer */}
      <Drawer isOpen={txnOpen} onClose={() => setTxnOpen(false)} width="440px" title="Record Payment">
        <div className="p-6 space-y-5">
          <div>
            <label className={labelCls}>Client Name *</label>
            <input value={txnForm.client_name} onChange={(e) => setTxnForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Priya & Rahul" className={inputCls} />
            {txnErrors.client_name && <p className="text-red-500 text-[12px] font-medium mt-1.5">{txnErrors.client_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Amount (₹) *</label>
              <input type="number" min={0} value={txnForm.amount} onChange={(e) => setTxnForm(f => ({ ...f, amount: e.target.value }))} placeholder="50000" className={inputCls} />
              {txnErrors.amount && <p className="text-red-500 text-[12px] font-medium mt-1.5">{txnErrors.amount}</p>}
            </div>
            <div>
              <label className={labelCls}>Method</label>
              <select value={txnForm.method} onChange={(e) => setTxnForm(f => ({ ...f, method: e.target.value }))} className={inputCls}>
                {["UPI", "Bank Transfer", "Cash", "Card"].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Booking Ref</label>
              <input value={txnForm.booking_ref} onChange={(e) => setTxnForm(f => ({ ...f, booking_ref: e.target.value }))} placeholder="#BK-1042 (optional)" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={txnForm.date} onChange={(e) => setTxnForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
              <p className="text-[11px] text-muted-foreground mt-1">Defaults to today.</p>
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={txnForm.notes} onChange={(e) => setTxnForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="e.g. Advance for wedding shoot" className="w-full px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <Button onClick={handleRecordPayment} disabled={txnSaving || !txnForm.client_name.trim() || !txnForm.amount.trim()} className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold">
            {txnSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Record Payment"}
          </Button>
          {(!txnForm.client_name.trim() || !txnForm.amount.trim()) && (
            <p className="text-[12px] text-muted-foreground text-center">Enter the client&apos;s name and the amount to continue.</p>
          )}
        </div>
      </Drawer>
    </div>
  );
}
