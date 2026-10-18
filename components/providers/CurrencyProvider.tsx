"use client";

import { createContext, useContext } from "react";
import { getCurrencySymbol } from "@/lib/currency";

const CurrencyContext = createContext<string>("Rs.");

export default function CurrencyProvider({
  currency,
  children,
}: {
  currency: string | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={getCurrencySymbol(currency)}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrencySymbol(): string {
  return useContext(CurrencyContext);
}
