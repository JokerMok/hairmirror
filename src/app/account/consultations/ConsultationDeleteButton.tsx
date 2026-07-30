"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConsultationDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this consultation? This cannot be undone.")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/consultations/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("delete failed");
      router.refresh();
    } catch {
      setBusy(false);
      window.alert("Unable to delete this consultation. Please try again.");
    }
  }

  return (
    <button
      type="button"
      aria-label="Delete consultation"
      disabled={busy}
      onClick={handleDelete}
      className="rounded-full border border-[#d7e3de] px-3 py-1 text-xs font-semibold text-[#6f817c] transition hover:border-[#b7645d] hover:text-[#a14d47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177761] disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
