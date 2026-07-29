import React, { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

interface JournalFigureMediaProps {
  src?: string;
  alt: string;
  placeholder: string;
  fallbackLabel: string;
}

export function JournalFigureMedia({ src, alt, placeholder, fallbackLabel }: JournalFigureMediaProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(src ? "loading" : "error");

  useEffect(() => {
    setStatus(src ? "loading" : "error");
  }, [src]);

  const failed = status === "error";

  return (
    <div
      style={{
        width: "100%",
        minHeight: 96,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: failed ? placeholder : "#f8fafc",
        border: "1px solid #d9dee7",
      }}
      role={failed ? "img" : undefined}
      aria-label={failed ? fallbackLabel : undefined}
      aria-busy={status === "loading"}
    >
      {failed ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "24px 12px", fontFamily: "system-ui, sans-serif", fontSize: "0.75rem", color: "#64748b" }}>
          <ImageOff size={18} strokeWidth={1.7} aria-hidden="true" />
          {fallbackLabel}
        </span>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="eager"
          decoding="async"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          style={{ display: "block", width: "auto", maxWidth: "100%", height: "auto", maxHeight: 520, objectFit: "contain", margin: "0 auto" }}
        />
      )}
    </div>
  );
}
