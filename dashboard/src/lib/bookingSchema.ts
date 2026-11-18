import { z } from "zod";

/* An <input type="number"> registered with `valueAsNumber` yields `NaN`
   when the field is left empty. Plain `z.number()` REJECTS NaN, so a single
   untouched optional number (custom price, guest count, advance…) silently
   failed the whole-form validation that runs on the final "Create Booking"
   click — the button appeared dead. These helpers coerce empty/NaN to a
   sensible value before validating. */
const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
  z.number().optional()
);
const requiredAmount = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
  z.number({ message: "Total amount is required" }).min(1, "Total amount is required")
);

export const bookingSchema = z.object({
  // Step 1 — Client Info
  clientType: z.enum(["existing", "new"]),
  existingClientId: z.string().optional(),
  
  // If new client:
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().optional(),
  clientWhatsApp: z.string().optional(),
  clientInstagram: z.string().optional(),
  clientCity: z.string().optional(),

  // Step 2 — Event Details
  eventType: z.enum(["Wedding", "Pre-Wedding", "Corporate", "Portrait", "Maternity", "Engagement", "Family", "Other"]),
  eventDate: z.string().min(1, "Event date is required"),
  eventEndDate: z.string().optional(), // For multi-day weddings
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  venueName: z.string().min(2, "Venue name is required"),
  venueCity: z.string().optional(),
  venueAddress: z.string().optional(),
  guestCount: optionalNumber,
  eventNotes: z.string().optional(),

  // Step 3 — Package & Team
  packageId: z.string().min(1, "Please select a package"),
  customAmount: optionalNumber, // Override package price
  assignedPhotographers: z.array(z.string()).min(1, "Assign at least one photographer"),
  assignedVideographers: z.array(z.string()).optional(),
  assignedEditors: z.array(z.string()).optional(),
  addOns: z.array(z.string()).optional(), // Selected add-on IDs

  // Step 4 — Payment & Notes
  totalAmount: requiredAmount,
  advanceAmount: optionalNumber,
  advancePaid: z.boolean().optional(),
  paymentMode: z.enum(["UPI", "Bank Transfer", "Cash", "Card", "Cheque"]).optional(),
  balanceDueDate: z.string().optional(),
  internalNotes: z.string().optional(),
  clientMessage: z.string().optional(),
  status: z.enum(["Inquiry", "Consultation", "Confirmed", "Pending", "Completed", "Cancelled"]).optional(),

}).superRefine((data, ctx) => {
  // Cross-field validation
  if (data.clientType === "existing" && !data.existingClientId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["existingClientId"], message: "Please select an existing client" });
  }

  // Use partial refined logic for nested optional data
  if (data.clientType === "new") {
    if (!data.clientName || data.clientName.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clientName"], message: "Client name is required for new clients" });
    }
    if (!data.clientPhone || !/^[6-9]\d{9}$/.test(data.clientPhone)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clientPhone"], message: "Enter a valid 10-digit Indian mobile number" });
    }
    if (data.clientEmail && data.clientEmail.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.clientEmail)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clientEmail"], message: "Enter a valid email" });
    }
  }

  if (data.advanceAmount && data.advanceAmount > data.totalAmount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["advanceAmount"], message: "Advance cannot exceed total amount" });
  }
  
  if (data.eventEndDate && data.eventEndDate < data.eventDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["eventEndDate"], message: "End date must be after start date" });
  }
});

// Declare form data type explicitly so react-hook-form doesn't choke on Zod v4 inferred defaults
export type BookingFormData = {
  clientType: "existing" | "new";
  existingClientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientWhatsApp?: string;
  clientInstagram?: string;
  clientCity?: string;
  eventType: "Wedding" | "Pre-Wedding" | "Corporate" | "Portrait" | "Maternity" | "Engagement" | "Family" | "Other";
  eventDate: string;
  eventEndDate?: string;
  startTime: string;
  endTime: string;
  venueName: string;
  venueCity?: string;
  venueAddress?: string;
  guestCount?: number;
  eventNotes?: string;
  packageId: string;
  customAmount?: number;
  assignedPhotographers: string[];
  assignedVideographers?: string[];
  assignedEditors?: string[];
  addOns?: string[];
  totalAmount: number;
  advanceAmount?: number;
  advancePaid?: boolean;
  paymentMode?: "UPI" | "Bank Transfer" | "Cash" | "Card" | "Cheque";
  balanceDueDate?: string;
  internalNotes?: string;
  clientMessage?: string;
  status?: "Inquiry" | "Consultation" | "Confirmed" | "Pending" | "Completed" | "Cancelled";
};
