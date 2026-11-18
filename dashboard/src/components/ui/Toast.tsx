"use client";

import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
}

const getStyles = (type: ToastType) => {
  switch (type) {
    case 'success':
      return { borderClass: 'border-l-emerald-500', icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> };
    case 'error':
      return { borderClass: 'border-l-red-500', icon: <AlertCircle className="h-5 w-5 text-red-500" /> };
    case 'warning':
      return { borderClass: 'border-l-amber-500', icon: <AlertTriangle className="h-5 w-5 text-amber-500" /> };
    case 'info':
    default:
      return { borderClass: 'border-l-blue-500', icon: <Info className="h-5 w-5 text-blue-500" /> };
  }
};

export const Toast = ({ message, type }: ToastProps) => {
  const { borderClass, icon } = getStyles(type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={`flex items-center gap-3 bg-card/95 backdrop-blur-md text-card-foreground shadow-xl border border-border rounded-lg px-4 py-3 min-w-[320px] max-w-[420px] border-l-[3.5px] ${borderClass} pointer-events-auto`}
    >
      <div className="shrink-0">{icon}</div>
      <p className="text-sm font-medium">{message}</p>
    </motion.div>
  );
};
