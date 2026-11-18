// src/data/mockData.ts

// --- INTERFACES --- //

export type EventType = "Wedding" | "Pre-Wedding" | "Corporate" | "Portrait" | "Maternity" | "Engagement" | "Family" | "Other";
export type BookingStatus = "Pending" | "Confirmed" | "Completed" | "Cancelled";
export type LeadStage = "New Inquiry" | "Contacted" | "Consultation Scheduled" | "Proposal Sent" | "Won" | "Lost";
export type LeadSource = "Instagram" | "WhatsApp" | "Google" | "Referral" | "Website";
export type ClientType = "Wedding" | "Corporate" | "Individual";
export type PaymentStatus = "Paid" | "Partially Paid" | "Pending" | "Overdue";
export type TeamRole = "Lead Photographer" | "Photographer" | "Videographer" | "Photo Editor" | "Cinematographer" | "Drone Operator";
export type TeamStatusEnum = "On Shoot" | "Available" | "Editing" | "On Leave";

export interface Booking {
  id: string; // e.g. #BK-1042
  clientId: string;
  clientName: string;
  eventType: EventType;
  date: string; // ISO string or specific format e.g. "2025-04-16T09:00:00"
  endDate: string;
  venue: string;
  city: string;
  packageId: string;
  packageName: string;
  teamAssignedIds: string[];
  amount: number;
  status: BookingStatus;
  notes?: string;
  timeline: {
    inquiry: string | null;
    consultation: string | null;
    confirmed: string | null;
    shoot: string | null;
    editing: string | null;
    delivered: string | null;
  };
  payment: {
    total: number;
    paid: number;
    due: number;
  };
}

export interface Lead {
  id: string; // e.g. #LD-804
  clientName: string;
  phone: string;
  email: string;
  instagram?: string;
  eventType: EventType;
  eventDate: string; // Estimated date
  budgetRange: string; // e.g. "₹80,000 – ₹1,20,000"
  source: LeadSource;
  stage: LeadStage;
  assignedToId: string;
  lastActivity: string;
  movedToStageAt: string; // ISO date for computing "days in stage"
  notes: { date: string; content: string; authorId: string }[];
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  whatsapp: string;
  instagram?: string;
  city: string;
  type: ClientType;
  totalBookings: number;
  totalSpend: number;
  lastShootDate: string;
  rating: number; // 1-5
  tags: string[]; // e.g. ["VIP", "Repeat Client", "Referrer"]
}

export interface TeamMember {
  id: string;
  name: string;
  role: TeamRole;
  status: TeamStatusEnum;
  currentAssignment?: string;
  skills: string[];
  upcomingShootsCount: number;
  phone: string;
  email: string;
  avatarInitials: string;
  joinDate: string;
  bio: string;
  equipment: string[];
  rating: number; // 1-5
  onTimeDeliveryRate: number; // Percentage
  monthEarnings: number;
}

export interface Package {
  id: string;
  name: string;
  category: EventType;
  price: number;
  description: string;
  inclusions: string[];
  addons: { name: string; price: number }[];
  popularity: number; // Percentage
  bookingsCount: number;
  isActive: boolean;
  requiredRoles: TeamRole[];
}

export interface Invoice {
  id: string; // #INV-2045
  clientId: string;
  clientName: string;
  bookingId: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  amountPaid: number;
  status: PaymentStatus;
  items?: { description: string; amount: number }[];
}

export interface Transaction {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  bookingId: string;
  method: "UPI" | "Bank Transfer" | "Cash" | "Card";
  amount: number;
  notes?: string;
}

// --- MOCK DATA --- //

export const teamMembers: TeamMember[] = [
  {
    id: "TM-001", name: "Kedar Gurav", role: "Lead Photographer", status: "Available",
    skills: ["Wedding", "Portrait", "Commercial"], upcomingShootsCount: 4,
    phone: "+91 98765 43210", email: "kedar@amouraffairs.in", avatarInitials: "KG",
    joinDate: "2020-01-15", bio: "Founder & Lead Creative with 10 years shooting luxury weddings.",
    equipment: ["Sony A7RV", "Sony 24-70mm GM II", "Profoto A10"], rating: 4.9, onTimeDeliveryRate: 98, monthEarnings: 150000
  },
  {
    id: "TM-002", name: "Rajat Kulkarni", role: "Photographer", status: "On Shoot",
    currentAssignment: "JW Marriott Hinjawadi Wedding", skills: ["Wedding", "Candid", "Event"], upcomingShootsCount: 6,
    phone: "+91 87654 32109", email: "rajat@amouraffairs.in", avatarInitials: "RK",
    joinDate: "2021-06-01", bio: "Master of candid moments. Specializes in Maharashtrian weddings.",
    equipment: ["Sony A7IV", "Sony 35mm f/1.4 GM"], rating: 4.7, onTimeDeliveryRate: 95, monthEarnings: 65000
  },
  {
    id: "TM-003", name: "Nikhil Thapar", role: "Photo Editor", status: "Editing",
    currentAssignment: "Editing Ritz-Carlton Gala", skills: ["Color Grading", "Retouching", "Lightroom"], upcomingShootsCount: 0,
    phone: "+91 76543 21098", email: "nikhil@amouraffairs.in", avatarInitials: "NT",
    joinDate: "2022-03-10", bio: "Fast and precise editor. Maintains the signature warm Amour Affairs tone.",
    equipment: ["Mac Studio M2", "Eizo ColorEdge 27", "Wacom Intuos"], rating: 4.8, onTimeDeliveryRate: 99, monthEarnings: 55000
  },
  {
    id: "TM-004", name: "Sunil Mehta", role: "Cinematographer", status: "On Leave",
    skills: ["Wedding Films", "Documentary", "Gimbal"], upcomingShootsCount: 2,
    phone: "+91 65432 10987", email: "sunil@amouraffairs.in", avatarInitials: "SM",
    joinDate: "2022-08-20", bio: "Cinematic storyteller with an eye for dramatic lighting.",
    equipment: ["FX3", "DJI RS3 Pro", "Sirui Anamorphic Set"], rating: 4.9, onTimeDeliveryRate: 92, monthEarnings: 85000
  },
  {
    id: "TM-005", name: "Priya Desai", role: "Photographer", status: "Available",
    skills: ["Pre-Wedding", "Maternity", "Portrait"], upcomingShootsCount: 5,
    phone: "+91 99887 76655", email: "priya@amouraffairs.in", avatarInitials: "PD",
    joinDate: "2023-01-10", bio: "Specializes in intimate portraits and pre-wedding conceptual shoots.",
    equipment: ["Canon R6 Mark II", "RF 85mm f/1.2"], rating: 4.8, onTimeDeliveryRate: 96, monthEarnings: 60000
  },
  {
    id: "TM-006", name: "Arjun Nair", role: "Drone Operator", status: "On Shoot",
    currentAssignment: "Lavasa Pre-Wedding", skills: ["Aerial Videography", "FPV", "Landscape"], upcomingShootsCount: 3,
    phone: "+91 88776 65544", email: "arjun@amouraffairs.in", avatarInitials: "AN",
    joinDate: "2023-05-15", bio: "Licensed drone pilot pushing the limits of aerial cinematography.",
    equipment: ["DJI Mavic 3 Cine", "DJI FPV"], rating: 4.6, onTimeDeliveryRate: 100, monthEarnings: 45000
  },
  {
    id: "TM-007", name: "Sneha Joshi", role: "Photo Editor", status: "Available",
    skills: ["Album Design", "Retouching"], upcomingShootsCount: 0,
    phone: "+91 77665 54433", email: "sneha@amouraffairs.in", avatarInitials: "SJ",
    joinDate: "2024-02-01", bio: "Detail-oriented album designer and editor.",
    equipment: ["M2 MacBook Pro 16", "BenQ 27 in"], rating: 4.7, onTimeDeliveryRate: 94, monthEarnings: 40000
  },
  {
    id: "TM-008", name: "Vikram Rao", role: "Videographer", status: "Available",
    skills: ["Event Coverage", "Highlights"], upcomingShootsCount: 4,
    phone: "+91 66554 43322", email: "vikram@amouraffairs.in", avatarInitials: "VR",
    joinDate: "2024-04-10", bio: "Reliable robust event shooter.",
    equipment: ["Sony A7SIII", "24-105mm G"], rating: 4.5, onTimeDeliveryRate: 93, monthEarnings: 50000
  }
];

export const clients: Client[] = [
  { id: "CL-01", name: "Aditi & Rohan", phone: "+91 98765 11111", email: "aditi.r@example.com", whatsapp: "+91 98765 11111", city: "Pune", type: "Wedding", totalBookings: 2, totalSpend: 250000, lastShootDate: "2025-02-15", rating: 5, tags: ["Repeat Client", "VIP"] },
  { id: "CL-02", name: "Neha Sharma", phone: "+91 98765 22222", email: "neha.s@example.com", whatsapp: "+91 98765 22222", city: "Mumbai", type: "Individual", totalBookings: 1, totalSpend: 45000, lastShootDate: "2025-03-10", rating: 4.5, tags: ["Referrer"] },
  { id: "CL-03", name: "TechNova Solutions", phone: "+91 98765 33333", email: "events@technova.in", whatsapp: "+91 98765 33333", city: "Pune", type: "Corporate", totalBookings: 4, totalSpend: 320000, lastShootDate: "2025-04-05", rating: 4.8, tags: ["VIP", "Repeat Client"] },
  { id: "CL-04", name: "Kunal & Shruti", phone: "+91 98765 44444", email: "kunal.s@example.com", whatsapp: "+91 98765 44444", city: "Pune", type: "Wedding", totalBookings: 1, totalSpend: 150000, lastShootDate: "2025-01-20", rating: 5, tags: [] },
  { id: "CL-05", name: "Pooja Hegde", phone: "+91 98765 55555", email: "pooja.h@example.com", whatsapp: "+91 98765 55555", city: "Pune", type: "Individual", totalBookings: 2, totalSpend: 35000, lastShootDate: "2024-11-12", rating: 4.2, tags: [] },
  { id: "CL-06", name: "Nexus Corp", phone: "+91 98765 66666", email: "marketing@nexus.in", whatsapp: "+91 98765 66666", city: "Bengaluru", type: "Corporate", totalBookings: 3, totalSpend: 180000, lastShootDate: "2024-12-05", rating: 4.7, tags: ["Repeat Client"] },
  { id: "CL-07", name: "Siddharth & Priya", phone: "+91 98765 77777", email: "sid.p@example.com", whatsapp: "+91 98765 77777", city: "Nashik", type: "Wedding", totalBookings: 1, totalSpend: 120000, lastShootDate: "2025-05-18", rating: 0, tags: [] },
  { id: "CL-08", name: "Rahul Deshmukh", phone: "+91 98765 88888", email: "rahul.d@example.com", whatsapp: "+91 98765 88888", city: "Pune", type: "Individual", totalBookings: 1, totalSpend: 15000, lastShootDate: "2024-09-22", rating: 4.9, tags: [] },
  { id: "CL-09", name: "Vibrant Events", phone: "+91 98765 99999", email: "hello@vibrantevents.in", whatsapp: "+91 98765 99999", city: "Pune", type: "Corporate", totalBookings: 6, totalSpend: 450000, lastShootDate: "2025-04-10", rating: 5, tags: ["VIP", "Repeat Client", "Referrer"] },
  { id: "CL-10", name: "Ananya & Kartik", phone: "+91 98765 00000", email: "ananya.k@example.com", whatsapp: "+91 98765 00000", city: "Pune", type: "Wedding", totalBookings: 2, totalSpend: 280000, lastShootDate: "2025-06-12", rating: 0, tags: ["VIP"] },
  { id: "CL-11", name: "Global Motors", phone: "+91 98711 11111", email: "pr@globalmotors.in", whatsapp: "+91 98711 11111", city: "Pune", type: "Corporate", totalBookings: 2, totalSpend: 220000, lastShootDate: "2024-10-30", rating: 4.6, tags: ["Repeat Client"] },
  { id: "CL-12", name: "Tanvi Joshi", phone: "+91 98722 22222", email: "tanvi.j@example.com", whatsapp: "+91 98722 22222", city: "Mumbai", type: "Individual", totalBookings: 1, totalSpend: 25000, lastShootDate: "2025-08-05", rating: 0, tags: [] },
  { id: "CL-13", name: "Meera & Varun", phone: "+91 98733 33333", email: "meera.v@example.com", whatsapp: "+91 98733 33333", city: "Pune", type: "Wedding", totalBookings: 1, totalSpend: 195000, lastShootDate: "2024-12-18", rating: 4.8, tags: [] },
  { id: "CL-14", name: "Elevate Tech", phone: "+91 98744 44444", email: "admin@elevatetech.in", whatsapp: "+91 98744 44444", city: "Pune", type: "Corporate", totalBookings: 1, totalSpend: 85000, lastShootDate: "2025-01-10", rating: 4.4, tags: [] },
  { id: "CL-15", name: "Smita Patel", phone: "+91 98755 55555", email: "smita.p@example.com", whatsapp: "+91 98755 55555", city: "Pune", type: "Individual", totalBookings: 3, totalSpend: 65000, lastShootDate: "2025-02-28", rating: 5, tags: ["Repeat Client"] },
  { id: "CL-16", name: "Isha & Sameer", phone: "+91 98766 66666", email: "isha.s@example.com", whatsapp: "+91 98766 66666", city: "Lonavala", type: "Wedding", totalBookings: 1, totalSpend: 310000, lastShootDate: "2025-07-20", rating: 0, tags: ["VIP"] },
  { id: "CL-17", name: "Kavya & Arjun", phone: "+91 98777 77777", email: "kavya.a@example.com", whatsapp: "+91 98777 77777", city: "Pune", type: "Wedding", totalBookings: 1, totalSpend: 140000, lastShootDate: "2024-11-25", rating: 4.7, tags: [] },
  { id: "CL-18", name: "Priya & Yash", phone: "+91 98788 88888", email: "priya.y@example.com", whatsapp: "+91 98788 88888", city: "Pune", type: "Wedding", totalBookings: 1, totalSpend: 175000, lastShootDate: "2025-09-10", rating: 0, tags: [] }
];

export const packages: Package[] = [
  { id: "PKG-01", name: "Wedding Premium", category: "Wedding", price: 150000, description: "Comprehensive coverage for luxury weddings.", inclusions: ["2 Photographers", "1 Videographer", "1 Drone Operator", "12-hour coverage", "500+ edited photos", "Cinematic highlights reel", "Online gallery", "Premium Album"], addons: [{ name: "Extra Hour", price: 10000 }, { name: "Same Day Edit", price: 25000 }], popularity: 45, bookingsCount: 42, isActive: true, requiredRoles: ["Lead Photographer", "Photographer", "Videographer", "Drone Operator", "Photo Editor"] },
  { id: "PKG-02", name: "Pre-Wedding Deluxe", category: "Pre-Wedding", price: 65000, description: "Cinematic pre-wedding shoot at a premium location.", inclusions: ["1 Photographer", "1 Cinematographer", "1 Drone Operator", "8-hour coverage", "200+ edited photos", "3 min cinematic teaser"], addons: [{ name: "MUA & Styling", price: 15000 }], popularity: 20, bookingsCount: 28, isActive: true, requiredRoles: ["Photographer", "Cinematographer", "Drone Operator", "Photo Editor"] },
  { id: "PKG-03", name: "Corporate Standard", category: "Corporate", price: 35000, description: "Professional coverage for corporate events and conferences.", inclusions: ["1 Photographer", "1 Videographer", "6-hour coverage", "Standard edited photos", "Raw video dump"], addons: [{ name: "Highlight Video", price: 15000 }], popularity: 15, bookingsCount: 35, isActive: true, requiredRoles: ["Photographer", "Videographer", "Photo Editor"] },
  { id: "PKG-04", name: "Wedding Basic", category: "Wedding", price: 95000, description: "Essential coverage for intimate weddings.", inclusions: ["2 Photographers", "8-hour coverage", "300+ edited photos", "Standard Album"], addons: [{ name: "Videographer", price: 30000 }], popularity: 10, bookingsCount: 18, isActive: true, requiredRoles: ["Photographer", "Photographer", "Photo Editor"] },
  { id: "PKG-05", name: "Portrait Session", category: "Portrait", price: 15000, description: "Premium solo portrait or portfolio session.", inclusions: ["1 Photographer", "2-hour coverage", "15 retouched photos", "Studio or outdoor"], addons: [{ name: "Extra Retouched Photo", price: 1000 }], popularity: 5, bookingsCount: 40, isActive: true, requiredRoles: ["Photographer", "Photo Editor"] },
  { id: "PKG-06", name: "Maternity Shoot", category: "Maternity", price: 18000, description: "Beautifully captured maternity memories.", inclusions: ["1 Photographer", "3-hour coverage", "25 retouched photos", "2 outfit changes"], addons: [{ name: "MUA", price: 8000 }], popularity: 5, bookingsCount: 22, isActive: true, requiredRoles: ["Photographer", "Photo Editor"] }
];

export const bookings: Booking[] = [
  { id: "#BK-1042", clientId: "CL-01", clientName: "Aditi & Rohan", eventType: "Wedding", date: "2025-04-16T09:00:00", endDate: "2025-04-16T21:00:00", venue: "The Ritz-Carlton", city: "Pune", packageId: "PKG-01", packageName: "Wedding Premium", teamAssignedIds: ["TM-001", "TM-002", "TM-004", "TM-006"], amount: 150000, status: "Confirmed", timeline: { inquiry: "2024-11-10", consultation: "2024-11-15", confirmed: "2024-11-20", shoot: null, editing: null, delivered: null }, payment: { total: 150000, paid: 75000, due: 75000 } },
  { id: "#BK-1043", clientId: "CL-03", clientName: "TechNova Solutions", eventType: "Corporate", date: "2025-04-20T10:00:00", endDate: "2025-04-20T18:00:00", venue: "JW Marriott Hinjawadi", city: "Pune", packageId: "PKG-03", packageName: "Corporate Standard", teamAssignedIds: ["TM-002", "TM-008"], amount: 50000, status: "Confirmed", timeline: { inquiry: "2025-02-05", consultation: null, confirmed: "2025-02-12", shoot: null, editing: null, delivered: null }, payment: { total: 50000, paid: 25000, due: 25000 } },
  { id: "#BK-1044", clientId: "CL-07", clientName: "Siddharth & Priya", eventType: "Wedding", date: "2025-05-18T16:00:00", endDate: "2025-05-19T02:00:00", venue: "Conrad Pune", city: "Pune", packageId: "PKG-04", packageName: "Wedding Basic", teamAssignedIds: ["TM-005", "TM-002"], amount: 120000, status: "Pending", timeline: { inquiry: "2025-01-20", consultation: "2025-02-01", confirmed: null, shoot: null, editing: null, delivered: null }, payment: { total: 120000, paid: 0, due: 120000 } },
  { id: "#BK-1045", clientId: "CL-10", clientName: "Ananya & Kartik", eventType: "Pre-Wedding", date: "2025-06-12T06:00:00", endDate: "2025-06-12T14:00:00", venue: "Lavasa City", city: "Lavasa", packageId: "PKG-02", packageName: "Pre-Wedding Deluxe", teamAssignedIds: ["TM-001", "TM-004", "TM-006"], amount: 65000, status: "Confirmed", timeline: { inquiry: "2025-03-01", consultation: "2025-03-05", confirmed: "2025-03-10", shoot: null, editing: null, delivered: null }, payment: { total: 65000, paid: 35000, due: 30000 } },
  { id: "#BK-1046", clientId: "CL-09", clientName: "Vibrant Events", eventType: "Corporate", date: "2025-04-10T18:00:00", endDate: "2025-04-10T23:00:00", venue: "Taj Blue Diamond", city: "Pune", packageId: "PKG-03", packageName: "Corporate Standard", teamAssignedIds: ["TM-002", "TM-008"], amount: 45000, status: "Completed", timeline: { inquiry: "2025-03-15", consultation: null, confirmed: "2025-03-18", shoot: "2025-04-10", editing: "2025-04-11", delivered: null }, payment: { total: 45000, paid: 45000, due: 0 } },
  { id: "#BK-1047", clientId: "CL-16", clientName: "Isha & Sameer", eventType: "Wedding", date: "2025-07-20T08:00:00", endDate: "2025-07-21T02:00:00", venue: "Aamby Valley", city: "Lonavala", packageId: "PKG-01", packageName: "Wedding Premium", teamAssignedIds: ["TM-001", "TM-005", "TM-004", "TM-006"], amount: 310000, status: "Confirmed", timeline: { inquiry: "2025-02-15", consultation: "2025-02-28", confirmed: "2025-03-15", shoot: null, editing: null, delivered: null }, payment: { total: 310000, paid: 100000, due: 210000 } },
  { id: "#BK-1048", clientId: "CL-18", clientName: "Priya & Yash", eventType: "Pre-Wedding", date: "2025-09-10T05:30:00", endDate: "2025-09-10T12:00:00", venue: "Empress Garden", city: "Pune", packageId: "PKG-02", packageName: "Pre-Wedding Deluxe", teamAssignedIds: ["TM-005", "TM-008"], amount: 55000, status: "Pending", timeline: { inquiry: "2025-04-01", consultation: "2025-04-10", confirmed: null, shoot: null, editing: null, delivered: null }, payment: { total: 55000, paid: 0, due: 55000 } }
];

// Add a helper function to subtract days from current date
const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

export const leads: Lead[] = [
  { id: "#LD-804", clientName: "Vikrant & Rhea", phone: "+91 99988 77766", email: "vikrant.rhea@email.com", eventType: "Wedding", eventDate: "2025-11-20T00:00:00", budgetRange: "₹1,50,000 – ₹2,00,000", source: "Instagram", stage: "New Inquiry", assignedToId: "TM-001", lastActivity: daysAgo(1), movedToStageAt: daysAgo(1), notes: [{ date: daysAgo(1), content: "Received DM on Insta requesting premium packages.", authorId: "TM-001" }] },
  { id: "#LD-805", clientName: "TCS Pune", phone: "+91 88877 66655", email: "events.pune@tcs.com", eventType: "Corporate", eventDate: "2025-05-15T00:00:00", budgetRange: "₹50,000 – ₹80,000", source: "Website", stage: "Contacted", assignedToId: "TM-002", lastActivity: daysAgo(3), movedToStageAt: daysAgo(7), notes: [{ date: daysAgo(3), content: "Sent email requesting requirements call.", authorId: "TM-002" }] },
  { id: "#LD-806", clientName: "Akash & Megha", phone: "+91 77766 55544", email: "akash.m@email.com", eventType: "Wedding", eventDate: "2025-12-05T00:00:00", budgetRange: "₹1,00,000 – ₹1,20,000", source: "WhatsApp", stage: "Consultation Scheduled", assignedToId: "TM-001", lastActivity: daysAgo(2), movedToStageAt: daysAgo(2), notes: [{ date: daysAgo(2), content: "Zoom call scheduled for this Friday.", authorId: "TM-001" }] },
  { id: "#LD-807", clientName: "Poonam Joshi", phone: "+91 66655 44433", email: "poonam.j@email.com", eventType: "Maternity", eventDate: "2025-05-25T00:00:00", budgetRange: "₹15,000 – ₹25,000", source: "Referral", stage: "Proposal Sent", assignedToId: "TM-005", lastActivity: daysAgo(1), movedToStageAt: daysAgo(12), notes: [{ date: daysAgo(1), content: "Followed up on the quote sent last week. She needs a couple days to confirm.", authorId: "TM-005" }] },
  { id: "#LD-808", clientName: "SunTech Innovations", phone: "+91 55544 33322", email: "admin@suntech.in", eventType: "Corporate", eventDate: "2025-06-10T00:00:00", budgetRange: "₹40,000 – ₹60,000", source: "Google", stage: "Won", assignedToId: "TM-002", lastActivity: daysAgo(5), movedToStageAt: daysAgo(5), notes: [{ date: daysAgo(5), content: "Confirmed booking, advance received.", authorId: "TM-002" }] },
  { id: "#LD-809", clientName: "Snehal & Kunal", phone: "+91 44433 22211", email: "snehal.k@email.com", eventType: "Pre-Wedding", eventDate: "2025-08-15T00:00:00", budgetRange: "₹30,000 – ₹50,000", source: "Instagram", stage: "Lost", assignedToId: "TM-005", lastActivity: daysAgo(20), movedToStageAt: daysAgo(20), notes: [{ date: daysAgo(20), content: "Budget too low for our packages. Recommended freelancer.", authorId: "TM-005" }] },
  { id: "#LD-810", clientName: "Rohan Kapoor", phone: "+91 33322 11100", email: "rohan.k@email.com", eventType: "Portrait", eventDate: "2025-04-30T00:00:00", budgetRange: "₹10,000 – ₹20,000", source: "Google", stage: "New Inquiry", assignedToId: "TM-005", lastActivity: daysAgo(0), movedToStageAt: daysAgo(0), notes: [{ date: daysAgo(0), content: "Looking for actor portfolio shots.", authorId: "TM-005" }] },
  { id: "#LD-811", clientName: "Maya & Sameer", phone: "+91 22211 00099", email: "maya.s@email.com", eventType: "Wedding", eventDate: "2025-10-18T00:00:00", budgetRange: "₹2,00,000 – ₹3,00,000", source: "Instagram", stage: "Contacted", assignedToId: "TM-001", lastActivity: daysAgo(6), movedToStageAt: daysAgo(11), notes: [{ date: daysAgo(6), content: "Left a voicemail.", authorId: "TM-001" }, { date: daysAgo(11), content: "Initial WhatsApp message sent.", authorId: "TM-001" }] }
];

export const invoices: Invoice[] = [
  { id: "#INV-2045", clientId: "CL-01", clientName: "Aditi & Rohan", bookingId: "#BK-1042", issueDate: "2024-11-20", dueDate: "2025-04-10", amount: 150000, amountPaid: 75000, status: "Partially Paid" },
  { id: "#INV-2046", clientId: "CL-03", clientName: "TechNova Solutions", bookingId: "#BK-1043", issueDate: "2025-02-12", dueDate: "2025-03-12", amount: 50000, amountPaid: 25000, status: "Partially Paid" },
  { id: "#INV-2047", clientId: "CL-06", clientName: "Nexus Corp", bookingId: "#BK-1041", issueDate: "2024-12-10", dueDate: "2025-01-10", amount: 80000, amountPaid: 80000, status: "Paid" },
  { id: "#INV-2048", clientId: "CL-18", clientName: "Priya & Yash", bookingId: "#BK-1048", issueDate: "2025-04-05", dueDate: "2025-04-20", amount: 55000, amountPaid: 0, status: "Pending" },
  { id: "#INV-2049", clientId: "CL-13", clientName: "Meera & Varun", bookingId: "#BK-1035", issueDate: "2024-12-25", dueDate: "2025-01-25", amount: 195000, amountPaid: 150000, status: "Overdue" }
];

export const transactions: Transaction[] = [
  { id: "TXN-901", date: "2024-11-20T10:30:00", clientId: "CL-01", clientName: "Aditi & Rohan", bookingId: "#BK-1042", method: "Bank Transfer", amount: 75000, notes: "Advance Payment 50%" },
  { id: "TXN-902", date: "2025-02-12T14:15:00", clientId: "CL-03", clientName: "TechNova Solutions", bookingId: "#BK-1043", method: "UPI", amount: 25000, notes: "Booking confirmation advance" },
  { id: "TXN-903", date: "2024-12-15T09:45:00", clientId: "CL-06", clientName: "Nexus Corp", bookingId: "#BK-1041", method: "Bank Transfer", amount: 40000, notes: "Advance" },
  { id: "TXN-904", date: "2025-01-05T16:20:00", clientId: "CL-06", clientName: "Nexus Corp", bookingId: "#BK-1041", method: "Bank Transfer", amount: 40000, notes: "Final Balance" },
  { id: "TXN-905", date: "2024-12-28T11:00:00", clientId: "CL-13", clientName: "Meera & Varun", bookingId: "#BK-1035", method: "UPI", amount: 150000, notes: "Major portion paid, balance 45K pending delivery." }
];
