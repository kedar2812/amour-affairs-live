"use client";

import React, { useEffect, useState } from "react";
import { COUNTRIES, composePhone, splitPhone } from "@/lib/phone";

interface PhoneInputProps {
  /** Stored form: "+919921000052" (legacy bare numbers tolerated). */
  value: string;
  onChange: (stored: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Country-code picker + national number input.
 * Emits the combined stored form ("+<dial><digits>") on every change,
 * so any country's number round-trips through the 30-char phone columns.
 */
export function PhoneInput({ value, onChange, placeholder = "99210 00052", className = "" }: PhoneInputProps) {
  const initial = splitPhone(value);
  const [iso, setIso] = useState(initial.iso);
  const [national, setNational] = useState(initial.national);

  // Resync when the parent swaps the value from outside (form reset, edit
  // prefill). Compare digits so mere re-formatting doesn't clobber typing.
  useEffect(() => {
    const current = composePhone(COUNTRIES.find((c) => c.iso === iso)?.dial || "91", national);
    if ((value || "") !== current) {
      const next = splitPhone(value);
      setIso(next.iso);
      setNational(next.national);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const dialOf = (isoCode: string) => COUNTRIES.find((c) => c.iso === isoCode)?.dial || "91";

  const emit = (nextIso: string, nextNational: string) => {
    onChange(composePhone(dialOf(nextIso), nextNational));
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        value={iso}
        onChange={(e) => { setIso(e.target.value); emit(e.target.value, national); }}
        title={COUNTRIES.find((c) => c.iso === iso)?.name}
        className="h-10 w-[104px] shrink-0 px-2 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[13px] focus:outline-none focus:border-primary/50"
      >
        {COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.flag} +{c.dial}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        value={national}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d\s-]/g, "");
          setNational(digits.replace(/[\s-]/g, ""));
          emit(iso, digits);
        }}
        placeholder={placeholder}
        className="w-full h-10 px-3 bg-muted/30 border border-border/50 rounded-lg text-foreground text-[14px] focus:outline-none focus:border-primary/50"
      />
    </div>
  );
}
