// src/data/mockChartData.ts
// Chart data scaffolding. All demo/sample figures have been zeroed out — these
// widgets are not yet wired to the live API, so they intentionally render an
// empty "no data yet" state instead of fabricated numbers. The shapes (labels,
// colours, time ranges) are preserved so the charts still lay out correctly and
// can be populated from real API data later.

export type TimeRange = "Week" | "Month" | "Year" | "Max";

export const revenueForecastData = {
  Week: [
    { name: "Mon", realised: 0, projected: 0 },
    { name: "Tue", realised: 0, projected: 0 },
    { name: "Wed", realised: 0, projected: 0 },
    { name: "Thu", realised: 0, projected: 0 },
    { name: "Fri", realised: 0, projected: 0 },
    { name: "Sat", realised: 0, projected: 0 },
    { name: "Sun", realised: 0, projected: 0 },
  ],
  Month: [
    { name: "Week 1", realised: 0, projected: 0 },
    { name: "Week 2", realised: 0, projected: 0 },
    { name: "Week 3", realised: 0, projected: 0 },
    { name: "Week 4", realised: 0, projected: 0 },
  ],
  Year: [
    { name: "Jan", realised: 0, projected: 0 },
    { name: "Feb", realised: 0, projected: 0 },
    { name: "Mar", realised: 0, projected: 0 },
    { name: "Apr", realised: 0, projected: 0 },
    { name: "May", realised: 0, projected: 0 },
    { name: "Jun", realised: 0, projected: 0 },
    { name: "Jul", realised: 0, projected: 0 },
    { name: "Aug", realised: 0, projected: 0 },
    { name: "Sep", realised: 0, projected: 0 },
    { name: "Oct", realised: 0, projected: 0 },
    { name: "Nov", realised: 0, projected: 0 },
    { name: "Dec", realised: 0, projected: 0 },
  ],
  Max: [
    { name: "Jan 2025", realised: 0, projected: 0 },
    { name: "Apr 2025", realised: 0, projected: 0 },
    { name: "Jul 2025", realised: 0, projected: 0 },
    { name: "Oct 2025", realised: 0, projected: 0 },
    { name: "Jan 2026", realised: 0, projected: 0 },
    { name: "Apr 2026", realised: 0, projected: 0 },
  ]
};

export const revenueKPIs = {
  Week: { total: "₹0", trend: "—", avg: "₹0", increaseText: "no data yet" },
  Month: { total: "₹0", trend: "—", avg: "₹0", increaseText: "no data yet" },
  Year: { total: "₹0", trend: "—", avg: "₹0", increaseText: "no data yet" },
  Max: { total: "₹0", trend: "—", avg: "₹0", increaseText: "no data yet" },
};

export const trafficBreakdownData = {
  Week: [
    { name: "Instagram", value: 0, color: "var(--primary)" },
    { name: "WhatsApp", value: 0, color: "#1A1A2E" },
    { name: "Google", value: 0, color: "#10B981" },
    { name: "Referral", value: 0, color: "#8B5CF6" },
    { name: "Website", value: 0, color: "#F59E0B" },
  ],
  Month: [
    { name: "Instagram", value: 0, color: "var(--primary)" },
    { name: "WhatsApp", value: 0, color: "#1A1A2E" },
    { name: "Google", value: 0, color: "#10B981" },
    { name: "Referral", value: 0, color: "#8B5CF6" },
    { name: "Website", value: 0, color: "#F59E0B" },
  ],
  Year: [
    { name: "Instagram", value: 0, color: "var(--primary)" },
    { name: "WhatsApp", value: 0, color: "#1A1A2E" },
    { name: "Google", value: 0, color: "#10B981" },
    { name: "Referral", value: 0, color: "#8B5CF6" },
    { name: "Website", value: 0, color: "#F59E0B" },
  ],
  Max: [
    { name: "Instagram", value: 0, color: "var(--primary)" },
    { name: "WhatsApp", value: 0, color: "#1A1A2E" },
    { name: "Google", value: 0, color: "#10B981" },
    { name: "Referral", value: 0, color: "#8B5CF6" },
    { name: "Website", value: 0, color: "#F59E0B" },
  ]
};

export const trafficKPIs = {
  Week: { count: 0, trend: "—" },
  Month: { count: 0, trend: "—" },
  Year: { count: 0, trend: "—" },
  Max: { count: 0, trend: "—" },
};

export const funnelDataConfig = {
  Week: [
    { stage: "Inquiry", count: 0, color: "var(--primary)" },
    { stage: "Consultation", count: 0, color: "hsl(var(--primary) / 0.8)" },
    { stage: "Proposal", count: 0, color: "hsl(var(--primary) / 0.65)" },
    { stage: "Booked", count: 0, color: "hsl(var(--primary) / 0.5)" },
    { stage: "Delivered", count: 0, color: "hsl(var(--primary) / 0.35)" },
  ],
  Month: [
    { stage: "Inquiry", count: 0, color: "var(--primary)" },
    { stage: "Consultation", count: 0, color: "hsl(var(--primary) / 0.8)" },
    { stage: "Proposal", count: 0, color: "hsl(var(--primary) / 0.65)" },
    { stage: "Booked", count: 0, color: "hsl(var(--primary) / 0.5)" },
    { stage: "Completed", count: 0, color: "hsl(var(--primary) / 0.35)" },
    { stage: "Delivered", count: 0, color: "hsl(var(--primary) / 0.2)" },
  ],
  Year: [
    { stage: "Inquiry", count: 0, color: "var(--primary)" },
    { stage: "Consultation", count: 0, color: "hsl(var(--primary) / 0.8)" },
    { stage: "Proposal", count: 0, color: "hsl(var(--primary) / 0.65)" },
    { stage: "Booked", count: 0, color: "hsl(var(--primary) / 0.5)" },
    { stage: "Delivered", count: 0, color: "hsl(var(--primary) / 0.35)" },
  ],
  Max: [
    { stage: "Inquiry", count: 0, color: "var(--primary)" },
    { stage: "Consultation", count: 0, color: "hsl(var(--primary) / 0.8)" },
    { stage: "Proposal", count: 0, color: "hsl(var(--primary) / 0.65)" },
    { stage: "Booked", count: 0, color: "hsl(var(--primary) / 0.5)" },
    { stage: "Delivered", count: 0, color: "hsl(var(--primary) / 0.35)" },
  ]
};

export const packagePerformanceData = {
  Week: [],
  Month: [],
  Year: [],
  Max: [],
} as Record<TimeRange, { title: string; price: string; bookings: number; revShare: number; trend: string; color: string }[]>;

// Analytics Specific Multi-Dimensional Data
export const analyticsYearCompData = {
  "Week": [
    { time: 'Mon', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Tue', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Wed', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Thu', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Fri', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Sat', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Sun', thisPeriod: 0, lastPeriod: 0 },
  ],
  "Month": [
    { time: 'Week 1', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Week 2', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Week 3', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Week 4', thisPeriod: 0, lastPeriod: 0 },
  ],
  "Year": [
    { time: 'Q1', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Q2', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Q3', thisPeriod: 0, lastPeriod: 0 },
    { time: 'Q4', thisPeriod: 0, lastPeriod: 0 },
  ],
  "Max": [
    { time: '2023', thisPeriod: 0, lastPeriod: 0 },
    { time: '2024', thisPeriod: 0, lastPeriod: 0 },
    { time: '2025', thisPeriod: 0, lastPeriod: 0 },
    { time: '2026', thisPeriod: 0, lastPeriod: 0 },
  ]
};

export const analyticsBookingTypesData = {
  "Week": [
    { name: 'Wedding', value: 0, color: 'var(--primary)' },
    { name: 'Pre-Wedding', value: 0, color: '#ec4899' },
    { name: 'Corporate', value: 0, color: '#3b82f6' },
  ],
  "Month": [
    { name: 'Wedding', value: 0, color: 'var(--primary)' },
    { name: 'Pre-Wedding', value: 0, color: '#ec4899' },
    { name: 'Corporate', value: 0, color: '#3b82f6' },
    { name: 'Portrait', value: 0, color: '#a855f7' },
    { name: 'Maternity', value: 0, color: '#10b981' },
  ],
  "Year": [
    { name: 'Wedding', value: 0, color: 'var(--primary)' },
    { name: 'Pre-Wedding', value: 0, color: '#ec4899' },
    { name: 'Corporate', value: 0, color: '#3b82f6' },
    { name: 'Portrait', value: 0, color: '#a855f7' },
    { name: 'Maternity', value: 0, color: '#10b981' },
  ],
  "Max": [
    { name: 'Wedding', value: 0, color: 'var(--primary)' },
    { name: 'Pre-Wedding', value: 0, color: '#ec4899' },
    { name: 'Corporate', value: 0, color: '#3b82f6' },
    { name: 'Portrait', value: 0, color: '#a855f7' },
    { name: 'Maternity', value: 0, color: '#10b981' },
  ]
};
