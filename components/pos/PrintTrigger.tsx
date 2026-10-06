"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PrintTrigger({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();

  useEffect(() => {
    function handleAfterPrint() {
      if (redirectTo) router.push(redirectTo);
    }
    window.addEventListener("afterprint", handleAfterPrint);
    const t = setTimeout(() => window.print(), 300);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [redirectTo, router]);

  return null;
}
