export const STYLIST_CONSULTATION_PATH = "/salon/consultations/new";

export function loginPath(nextPath: string) {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function salonStartPath(
  role: "personal" | "store_owner" | "staff" | null,
) {
  if (role === "personal") return "/consumer";
  if (role === "store_owner" || role === "staff") {
    return STYLIST_CONSULTATION_PATH;
  }
  return loginPath(STYLIST_CONSULTATION_PATH);
}
