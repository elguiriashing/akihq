"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function VenueQrCode({
  value,
  alt,
  errorLabel,
  loadingLabel,
}: {
  value: string;
  alt: string;
  errorLabel: string;
  loadingLabel: string;
}) {
  const [source, setSource] = useState<string | null>();

  useEffect(() => {
    let active = true;
    void import("qrcode")
      .then(async ({ default: QRCode }) => {
        const dataUrl = await QRCode.toDataURL(value, {
          color: { dark: "#121c30", light: "#ffffff" },
          errorCorrectionLevel: "M",
          margin: 2,
          width: 320,
        });
        if (active) setSource(dataUrl);
      })
      .catch(() => {
        if (active) setSource(null);
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (source === undefined) {
    return (
      <span className="check-in-qr qr-loading" role="status">
        {loadingLabel}
      </span>
    );
  }

  if (source === null) {
    return <p className="notice">{errorLabel}</p>;
  }

  return (
    <Image
      className="check-in-qr"
      src={source}
      width={320}
      height={320}
      unoptimized
      alt={alt}
    />
  );
}
