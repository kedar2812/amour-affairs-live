"use client";

import { useEffect, useRef } from "react";
import { animate } from "framer-motion";

interface AnimatedCounterProps {
  value: string | number;
  duration?: number;
}

export function AnimatedCounter({ value, duration = 1.2 }: AnimatedCounterProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const valStr = String(value);
    
    // Regular expression to match:
    // 1. Optional non-digit characters at the start (prefix, e.g. "₹", "+")
    // 2. A decimal number (digits, optional dot, optional digits)
    // 3. Optional characters at the end (suffix, e.g. "L", "%", "+")
    const match = valStr.match(/^([^\d\.]*)([\d\.]+)([^\d]*)$/);

    if (!match) {
      // If we cannot parse it, just display the raw value
      node.textContent = valStr;
      return;
    }

    const prefix = match[1] || "";
    const targetNumber = parseFloat(match[2]);
    const suffix = match[3] || "";
    const isDecimal = match[2].includes(".");
    const decimalPlaces = isDecimal ? match[2].split(".")[1].length : 0;

    const controls = animate(0, targetNumber, {
      duration,
      ease: "easeOut",
      onUpdate(value) {
        const formattedNumber = value.toFixed(decimalPlaces);
        node.textContent = `${prefix}${formattedNumber}${suffix}`;
      },
    });

    return () => controls.stop();
  }, [value, duration]);

  return <span ref={nodeRef} className="tabular-nums">0</span>;
}
