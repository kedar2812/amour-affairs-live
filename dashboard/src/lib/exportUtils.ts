// src/lib/exportUtils.ts
// Universal export engine for Amour Affairs Dashboard

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// -------------------------------------------------------
// TYPES
// -------------------------------------------------------

export interface DatasetSheet {
  /** The name of the tab / section (e.g. "Bookings", "Clients") */
  sheetName: string;
  /** Column headers for the table */
  columns: string[];
  /** Row data — each inner array maps 1:1 to columns[] */
  rows: (string | number)[][];
}

// -------------------------------------------------------
// EXCEL EXPORT
// -------------------------------------------------------

/**
 * Generates and downloads an .xlsx workbook.
 * Each DatasetSheet becomes a separate tab inside the Excel file.
 */
export function downloadExcel(datasets: DatasetSheet[], filename: string) {
  const wb = XLSX.utils.book_new();

  datasets.forEach((ds) => {
    const wsData = [ds.columns, ...ds.rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-size columns based on content width
    const colWidths = ds.columns.map((col, i) => {
      const maxDataLen = ds.rows.reduce((max, row) => {
        const cellLen = String(row[i] ?? "").length;
        return cellLen > max ? cellLen : max;
      }, col.length);
      return { wch: Math.min(maxDataLen + 2, 40) };
    });
    ws["!cols"] = colWidths;

    // Style the header row bold
    // (xlsx community edition does not support cell styling natively,
    //  but column widths still massively improve readability)

    XLSX.utils.book_append_sheet(wb, ws, ds.sheetName.substring(0, 31)); // Excel tab name limit
  });

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// -------------------------------------------------------
// PDF EXPORT
// -------------------------------------------------------

/**
 * Generates and downloads a branded PDF report.
 * Each DatasetSheet becomes a headed table section in the document.
 */
export function downloadPDF(datasets: DatasetSheet[], filename: string, title: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // -- Branding Header --
  doc.setFillColor(15, 17, 23); // dark brand bg
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(201, 169, 110); // #c9a96e gold
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("AMOUR AFFAIRS", 14, 14);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 22);

  // Timestamp — always Indian time, wherever the export is generated
  const now = new Date();
  const stamp = now.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(`Generated: ${stamp}`, pageWidth - 14, 22, { align: "right" });

  let startY = 36;

  datasets.forEach((ds, idx) => {
    // Section heading
    if (idx > 0) {
      // check if we need a new page
      if (startY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        startY = 16;
      }
    }

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(ds.sheetName, 14, startY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`${ds.rows.length} records`, 14 + doc.getTextWidth(ds.sheetName) + 4, startY);

    startY += 4;

    autoTable(doc, {
      startY,
      head: [ds.columns],
      body: ds.rows.map((row) => row.map((cell) => String(cell))),
      theme: "grid",
      headStyles: {
        fillColor: [22, 27, 39], // #161b27
        textColor: [201, 169, 110], // gold
        fontStyle: "bold",
        fontSize: 8,
        halign: "left",
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [40, 40, 40],
        cellPadding: 2.5,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 248],
      },
      styles: {
        lineColor: [220, 220, 225],
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => {
        // Footer on every page
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `Amour Affairs · Confidential · Page ${doc.getNumberOfPages()}`,
          pageWidth / 2,
          pageH - 6,
          { align: "center" }
        );
      },
    });

    // Get the Y after the table was drawn
    startY = (doc as any).lastAutoTable.finalY + 14;
  });

  doc.save(`${filename}.pdf`);
}

// -------------------------------------------------------
// DATA FLATTENERS
// These transform your raw mockData objects into DatasetSheet format
// -------------------------------------------------------

import type { Booking, Lead, Client, TeamMember, Invoice, Package, Transaction } from "@/data/mockData";

export function flattenInvoices(invoices: Invoice[]): DatasetSheet {
  return {
    sheetName: "Invoices",
    columns: ["Invoice #", "Client", "Booking Ref", "Issue Date", "Due Date", "Amount (₹)", "Paid (₹)", "Balance Due (₹)", "Status"],
    rows: invoices.map((i) => [
      i.id, i.clientName, i.bookingId,
      (i.issueDate || "").split("T")[0], (i.dueDate || "").split("T")[0],
      i.amount, i.amountPaid, i.amount - i.amountPaid, i.status,
    ]),
  };
}

export function flattenTransactions(transactions: Transaction[]): DatasetSheet {
  return {
    sheetName: "Transactions",
    columns: ["Ref", "Date", "Client", "Booking Ref", "Method", "Amount (₹)", "Notes"],
    rows: transactions.map((t) => [
      t.id, (t.date || "").split("T")[0], t.clientName, t.bookingId, t.method, t.amount, t.notes || "",
    ]),
  };
}

export function flattenBookings(bookings: Booking[]): DatasetSheet {
  return {
    sheetName: "Bookings",
    columns: [
      "ID", "Client", "Event Type", "Date", "End Date",
      "Venue", "City", "Package", "Status",
      "Total (₹)", "Paid (₹)", "Due (₹)", "Notes",
    ],
    rows: bookings.map((b) => [
      b.id,
      b.clientName,
      b.eventType,
      b.date.split("T")[0],
      b.endDate.split("T")[0],
      b.venue,
      b.city,
      b.packageName,
      b.status,
      b.payment.total,
      b.payment.paid,
      b.payment.due,
      b.notes || "",
    ]),
  };
}

export function flattenLeads(leads: Lead[]): DatasetSheet {
  // The live API returns snake_case lead rows while the demo data is
  // camelCase — read both so the export is never blank.
  const rows = (leads as unknown as Record<string, unknown>[]).map((l) => [
    String(l.lead_ref ?? l.id ?? ""),
    String(l.client_name ?? l.clientName ?? ""),
    String(l.phone ?? ""),
    String(l.email ?? ""),
    String(l.event_type ?? l.eventType ?? ""),
    String(l.event_date ?? l.eventDate ?? ""),
    String(l.budget_range ?? l.budgetRange ?? ""),
    String(l.source ?? ""),
    String(l.stage ?? ""),
    String(l.last_activity ?? l.lastActivity ?? ""),
  ]);
  return {
    sheetName: "Leads",
    columns: [
      "ID", "Name", "Phone", "Email", "Event Type",
      "Event Date", "Budget Range", "Source", "Stage",
      "Last Activity",
    ],
    rows,
  };
}

export function flattenClients(clients: Client[]): DatasetSheet {
  return {
    sheetName: "Clients",
    columns: [
      "ID", "Name", "Phone", "Email", "WhatsApp",
      "City", "Type", "Total Bookings", "Total Spend (₹)",
      "Last Shoot", "Rating", "Tags",
    ],
    // Read defensively — the Clients page passes a trimmed row shape that may
    // omit lastShootDate / rating, and blank should print as "" not "undefined".
    rows: clients.map((c) => [
      c.id ?? "",
      c.name ?? "",
      c.phone ?? "",
      c.email ?? "",
      c.whatsapp ?? "",
      c.city ?? "",
      c.type ?? "",
      c.totalBookings ?? 0,
      c.totalSpend ?? 0,
      (c.lastShootDate ?? "") as string,
      (c.rating ?? "") as number | string,
      Array.isArray(c.tags) ? c.tags.join(", ") : "",
    ]),
  };
}

export function flattenTeam(team: TeamMember[]): DatasetSheet {
  return {
    sheetName: "Team",
    columns: [
      "ID", "Name", "Role", "Status", "Phone",
      "Email", "Skills", "Upcoming Shoots",
      "Rating", "On-Time Delivery %", "Monthly Earnings (₹)",
    ],
    rows: team.map((t) => [
      t.id,
      t.name,
      t.role,
      t.status,
      t.phone,
      t.email,
      t.skills.join(", "),
      t.upcomingShootsCount,
      t.rating,
      t.onTimeDeliveryRate,
      t.monthEarnings,
    ]),
  };
}

export function flattenPackages(packages: Package[]): DatasetSheet {
  return {
    sheetName: "Packages",
    columns: [
      "ID", "Name", "Category", "Price (₹)", "Description",
      "Inclusions", "Active", "Bookings Count", "Popularity %",
    ],
    rows: packages.map((p) => [
      p.id,
      p.name,
      p.category,
      p.price,
      p.description,
      p.inclusions.join("; "),
      p.isActive ? "Yes" : "No",
      p.bookingsCount,
      p.popularity,
    ]),
  };
}
