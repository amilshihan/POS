"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PrintTrigger({
  redirectTo,
  autoOpenDrawer,
}: {
  redirectTo?: string;
  autoOpenDrawer?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    function handleAfterPrint() {
      if (autoOpenDrawer) {
        fetch("/api/cash-drawer/open", { method: "POST" }).catch(() => {});
      }
      if (redirectTo) router.push(redirectTo);
    }
    window.addEventListener("afterprint", handleAfterPrint);
    const t = setTimeout(() => window.print(), 300);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [redirectTo, autoOpenDrawer, router]);

  return null;
}
