"use client";

import Image from "next/image";
import Link from "next/link";

/** Presentation only: the official PNG is never cropped, recolored or edited. */
export function UcsaBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="brand ucsa-brand"
      aria-label="UCSA Elections home"
    >
      <span className="ucsa-logo-frame">
        <Image
          unoptimized
          src="/ucsa-logo.png"
          alt="Official UCSA logo"
          width={56}
          height={56}
        />
      </span>
      {!compact && (
        <span>
          <strong>
            UCSA<span className="brand-dot">.</span>
          </strong>
          <small>ELECTION MANAGEMENT</small>
        </span>
      )}
    </Link>
  );
}
