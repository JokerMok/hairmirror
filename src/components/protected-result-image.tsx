"use client";

import Image from "next/image";
import { useState } from "react";

export function ProtectedResultImage({
  src,
  alt,
  retryLabel,
  errorLabel,
  className = "object-cover",
}: {
  src: string;
  alt: string;
  retryLabel: string;
  errorLabel: string;
  className?: string;
}) {
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const separator = src.includes("?") ? "&" : "?";
  const resolvedSrc = retry ? `${src}${separator}retry=${retry}` : src;

  if (failed)
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#eef1ee] p-6 text-center">
        <div>
          <p className="text-sm text-[#59625e]">{errorLabel}</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setRetry(Date.now());
            }}
            className="mt-3 min-h-11 rounded-full border border-[#bfc9c3] bg-white px-5 text-sm font-semibold text-[#174c40] hover:bg-[#f7f9f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5c]"
          >
            {retryLabel}
          </button>
        </div>
      </div>
    );

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      fill
      unoptimized
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
