/**
 * ============================================================
 * AMOUR AFFAIRS — International phone helpers
 * ============================================================
 * The studio works with NRI / international clients, so phone
 * numbers are stored in E.164-ish form ("+<dial><number>") and
 * entered through a country-code picker. Legacy rows may hold
 * bare 10-digit Indian numbers — every helper tolerates those.
 * ============================================================
 */

export interface Country {
  name: string;
  iso: string;
  dial: string; // digits only, no '+'
  flag: string;
}

// India first (the default), then alphabetical. Covers every dial code the
// studio is realistically going to meet; "Other" style edge cases can be
// typed with the full number after picking the closest code.
export const COUNTRIES: Country[] = [
  { name: "India", iso: "IN", dial: "91", flag: "🇮🇳" },
  { name: "Afghanistan", iso: "AF", dial: "93", flag: "🇦🇫" },
  { name: "Argentina", iso: "AR", dial: "54", flag: "🇦🇷" },
  { name: "Australia", iso: "AU", dial: "61", flag: "🇦🇺" },
  { name: "Austria", iso: "AT", dial: "43", flag: "🇦🇹" },
  { name: "Bahrain", iso: "BH", dial: "973", flag: "🇧🇭" },
  { name: "Bangladesh", iso: "BD", dial: "880", flag: "🇧🇩" },
  { name: "Belgium", iso: "BE", dial: "32", flag: "🇧🇪" },
  { name: "Bhutan", iso: "BT", dial: "975", flag: "🇧🇹" },
  { name: "Brazil", iso: "BR", dial: "55", flag: "🇧🇷" },
  { name: "Brunei", iso: "BN", dial: "673", flag: "🇧🇳" },
  { name: "Bulgaria", iso: "BG", dial: "359", flag: "🇧🇬" },
  { name: "Cambodia", iso: "KH", dial: "855", flag: "🇰🇭" },
  { name: "Canada", iso: "CA", dial: "1", flag: "🇨🇦" },
  { name: "Chile", iso: "CL", dial: "56", flag: "🇨🇱" },
  { name: "China", iso: "CN", dial: "86", flag: "🇨🇳" },
  { name: "Colombia", iso: "CO", dial: "57", flag: "🇨🇴" },
  { name: "Croatia", iso: "HR", dial: "385", flag: "🇭🇷" },
  { name: "Cyprus", iso: "CY", dial: "357", flag: "🇨🇾" },
  { name: "Czech Republic", iso: "CZ", dial: "420", flag: "🇨🇿" },
  { name: "Denmark", iso: "DK", dial: "45", flag: "🇩🇰" },
  { name: "Egypt", iso: "EG", dial: "20", flag: "🇪🇬" },
  { name: "Ethiopia", iso: "ET", dial: "251", flag: "🇪🇹" },
  { name: "Fiji", iso: "FJ", dial: "679", flag: "🇫🇯" },
  { name: "Finland", iso: "FI", dial: "358", flag: "🇫🇮" },
  { name: "France", iso: "FR", dial: "33", flag: "🇫🇷" },
  { name: "Georgia", iso: "GE", dial: "995", flag: "🇬🇪" },
  { name: "Germany", iso: "DE", dial: "49", flag: "🇩🇪" },
  { name: "Greece", iso: "GR", dial: "30", flag: "🇬🇷" },
  { name: "Hong Kong", iso: "HK", dial: "852", flag: "🇭🇰" },
  { name: "Hungary", iso: "HU", dial: "36", flag: "🇭🇺" },
  { name: "Iceland", iso: "IS", dial: "354", flag: "🇮🇸" },
  { name: "Indonesia", iso: "ID", dial: "62", flag: "🇮🇩" },
  { name: "Iran", iso: "IR", dial: "98", flag: "🇮🇷" },
  { name: "Iraq", iso: "IQ", dial: "964", flag: "🇮🇶" },
  { name: "Ireland", iso: "IE", dial: "353", flag: "🇮🇪" },
  { name: "Israel", iso: "IL", dial: "972", flag: "🇮🇱" },
  { name: "Italy", iso: "IT", dial: "39", flag: "🇮🇹" },
  { name: "Japan", iso: "JP", dial: "81", flag: "🇯🇵" },
  { name: "Jordan", iso: "JO", dial: "962", flag: "🇯🇴" },
  { name: "Kazakhstan", iso: "KZ", dial: "7", flag: "🇰🇿" },
  { name: "Kenya", iso: "KE", dial: "254", flag: "🇰🇪" },
  { name: "Kuwait", iso: "KW", dial: "965", flag: "🇰🇼" },
  { name: "Lebanon", iso: "LB", dial: "961", flag: "🇱🇧" },
  { name: "Luxembourg", iso: "LU", dial: "352", flag: "🇱🇺" },
  { name: "Malaysia", iso: "MY", dial: "60", flag: "🇲🇾" },
  { name: "Maldives", iso: "MV", dial: "960", flag: "🇲🇻" },
  { name: "Malta", iso: "MT", dial: "356", flag: "🇲🇹" },
  { name: "Mauritius", iso: "MU", dial: "230", flag: "🇲🇺" },
  { name: "Mexico", iso: "MX", dial: "52", flag: "🇲🇽" },
  { name: "Morocco", iso: "MA", dial: "212", flag: "🇲🇦" },
  { name: "Myanmar", iso: "MM", dial: "95", flag: "🇲🇲" },
  { name: "Nepal", iso: "NP", dial: "977", flag: "🇳🇵" },
  { name: "Netherlands", iso: "NL", dial: "31", flag: "🇳🇱" },
  { name: "New Zealand", iso: "NZ", dial: "64", flag: "🇳🇿" },
  { name: "Nigeria", iso: "NG", dial: "234", flag: "🇳🇬" },
  { name: "Norway", iso: "NO", dial: "47", flag: "🇳🇴" },
  { name: "Oman", iso: "OM", dial: "968", flag: "🇴🇲" },
  { name: "Pakistan", iso: "PK", dial: "92", flag: "🇵🇰" },
  { name: "Philippines", iso: "PH", dial: "63", flag: "🇵🇭" },
  { name: "Poland", iso: "PL", dial: "48", flag: "🇵🇱" },
  { name: "Portugal", iso: "PT", dial: "351", flag: "🇵🇹" },
  { name: "Qatar", iso: "QA", dial: "974", flag: "🇶🇦" },
  { name: "Romania", iso: "RO", dial: "40", flag: "🇷🇴" },
  { name: "Russia", iso: "RU", dial: "7", flag: "🇷🇺" },
  { name: "Saudi Arabia", iso: "SA", dial: "966", flag: "🇸🇦" },
  { name: "Serbia", iso: "RS", dial: "381", flag: "🇷🇸" },
  { name: "Seychelles", iso: "SC", dial: "248", flag: "🇸🇨" },
  { name: "Singapore", iso: "SG", dial: "65", flag: "🇸🇬" },
  { name: "Slovakia", iso: "SK", dial: "421", flag: "🇸🇰" },
  { name: "South Africa", iso: "ZA", dial: "27", flag: "🇿🇦" },
  { name: "South Korea", iso: "KR", dial: "82", flag: "🇰🇷" },
  { name: "Spain", iso: "ES", dial: "34", flag: "🇪🇸" },
  { name: "Sri Lanka", iso: "LK", dial: "94", flag: "🇱🇰" },
  { name: "Sweden", iso: "SE", dial: "46", flag: "🇸🇪" },
  { name: "Switzerland", iso: "CH", dial: "41", flag: "🇨🇭" },
  { name: "Taiwan", iso: "TW", dial: "886", flag: "🇹🇼" },
  { name: "Tanzania", iso: "TZ", dial: "255", flag: "🇹🇿" },
  { name: "Thailand", iso: "TH", dial: "66", flag: "🇹🇭" },
  { name: "Turkey", iso: "TR", dial: "90", flag: "🇹🇷" },
  { name: "Uganda", iso: "UG", dial: "256", flag: "🇺🇬" },
  { name: "Ukraine", iso: "UA", dial: "380", flag: "🇺🇦" },
  { name: "United Arab Emirates", iso: "AE", dial: "971", flag: "🇦🇪" },
  { name: "United Kingdom", iso: "GB", dial: "44", flag: "🇬🇧" },
  { name: "United States", iso: "US", dial: "1", flag: "🇺🇸" },
  { name: "Uzbekistan", iso: "UZ", dial: "998", flag: "🇺🇿" },
  { name: "Vietnam", iso: "VN", dial: "84", flag: "🇻🇳" },
  { name: "Zambia", iso: "ZM", dial: "260", flag: "🇿🇲" },
  { name: "Zimbabwe", iso: "ZW", dial: "263", flag: "🇿🇼" },
];

export const DEFAULT_ISO = "IN";

const onlyDigits = (v: string): string => v.replace(/\D/g, "");

/** Build the stored form: "+919921000052". Empty national → "". */
export function composePhone(dial: string, national: string): string {
  const n = onlyDigits(national).replace(/^0+/, "");
  if (!n) return "";
  return `+${dial}${n}`;
}

/**
 * Split a stored phone into { iso, dial, national } for the picker.
 * Handles "+CCNNN", "00CCNNN" and legacy bare Indian 10-digit numbers.
 */
export function splitPhone(stored: string | null | undefined): { iso: string; dial: string; national: string } {
  const india = { iso: "IN", dial: "91", national: "" };
  if (!stored) return india;

  let digits = onlyDigits(String(stored).replace(/^00/, "+"));
  const hadPlus = /^\s*\+/.test(String(stored)) || /^\s*00/.test(String(stored));

  if (!hadPlus) {
    // Legacy bare numbers: 10-digit Indian mobile, or "91..." with country code
    if (/^[6-9]\d{9}$/.test(digits)) return { ...india, national: digits };
    if (/^91[6-9]\d{9}$/.test(digits)) return { ...india, national: digits.slice(2) };
    if (/^0[6-9]\d{9}$/.test(digits)) return { ...india, national: digits.slice(1) };
    return { ...india, national: digits };
  }

  // Longest-prefix match against known dial codes (prefer IN for "91")
  let best: Country | null = null;
  for (const c of COUNTRIES) {
    if (digits.startsWith(c.dial)) {
      if (!best || c.dial.length > best.dial.length) best = c;
    }
  }
  if (!best) return { ...india, national: digits };
  return { iso: best.iso, dial: best.dial, national: digits.slice(best.dial.length) };
}

/** Loose E.164 sanity check on the stored form (any country). */
export function isValidStoredPhone(stored: string): boolean {
  const { dial, national } = splitPhone(stored);
  const total = dial.length + national.length;
  return national.length >= 4 && total >= 7 && total <= 15;
}

/** Digits for a wa.me link: "+91 99210 00052" → "919921000052". */
export function waDigits(stored: string | null | undefined): string {
  if (!stored) return "";
  const { dial, national } = splitPhone(stored);
  if (!national) return "";
  return dial + national;
}

/** wa.me deep link with a pre-filled message. Empty when no usable number. */
export function waLink(stored: string | null | undefined, message: string): string {
  const digits = waDigits(stored);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Pretty display: "+91 99210 00052" (Indian grouping) or "+44 7911123456". */
export function formatPhone(stored: string | null | undefined): string {
  if (!stored) return "";
  const { dial, national } = splitPhone(stored);
  if (!national) return String(stored);
  if (dial === "91" && national.length === 10) {
    return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return `+${dial} ${national}`;
}
