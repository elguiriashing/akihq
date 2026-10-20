"use client";

import { useEffect, useState } from "react";

/** Carry only a validated public code; never propagate the source URL or credentials. */
export function useSuiteReferral() {
  const [referralCode, setReferralCode] = useState<string>();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codes = params.getAll("ref");
    setReferralCode(
      codes.length === 1 && /^[A-Z0-9]{8,24}$/.test(codes[0])
        ? codes[0]
        : undefined,
    );
  }, []);
  return referralCode;
}
