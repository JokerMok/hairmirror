import type { ConsultationBrief, DesignPreferences } from "@/lib/types";

export const STUDIO_DRAFT_KEY = "hairmirror:studio-draft:v1";
export const SALON_DRAFT_KEY = "hairmirror:salon-draft:v1";

export type StudioConsultationDraft = {
  version: 1;
  photo: string;
  consent: boolean;
  preferences: DesignPreferences;
  step: 2;
  savedAt: number;
};

export type SalonConsultationDraft = {
  version: 1;
  photo: string;
  consentAccepted: boolean;
  customerEmail: string;
  brief: ConsultationBrief;
  savedAt: number;
};

const MAX_AGE_MS = 60 * 60 * 1000;
const DATABASE_NAME = "hairmirror-drafts";
const STORE_NAME = "drafts";

function sessionFallback<T>(key: string, value?: T | null) {
  if (typeof window === "undefined") return null;
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else if (value !== undefined) window.sessionStorage.setItem(key, JSON.stringify(value));
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function openDatabase() {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return new Promise<IDBDatabase | null>((resolve) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function writeDraft<T>(key: string, value: T) {
  const database = await openDatabase();
  if (!database) {
    sessionFallback(key, value);
    return;
  }
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      sessionFallback(key, value);
      resolve();
    };
  });
  database.close();
}

async function readDraft<T>(key: string) {
  const database = await openDatabase();
  if (!database) return sessionFallback<T>(key);
  const value = await new Promise<T | null>((resolve) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
  database.close();
  if (value) return value;
  return sessionFallback<T>(key);
}

async function deleteDraft(key: string) {
  const database = await openDatabase();
  if (database) {
    await new Promise<void>((resolve) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
    database.close();
  }
  sessionFallback(key, null);
}

function isFresh<T extends { savedAt?: number }>(draft: T | null): draft is T {
  return Boolean(draft && typeof draft.savedAt === "number" && Date.now() - draft.savedAt <= MAX_AGE_MS);
}

export async function saveStudioDraft(draft: Omit<StudioConsultationDraft, "version" | "savedAt">) {
  await writeDraft(STUDIO_DRAFT_KEY, { ...draft, version: 1, savedAt: Date.now() } satisfies StudioConsultationDraft);
}

export async function loadStudioDraft() {
  const draft = await readDraft<StudioConsultationDraft>(STUDIO_DRAFT_KEY);
  if (!isFresh(draft) || draft.version !== 1 || !draft.photo) {
    if (draft) await deleteDraft(STUDIO_DRAFT_KEY);
    return null;
  }
  return draft;
}

export function clearStudioDraft() {
  void deleteDraft(STUDIO_DRAFT_KEY);
}

export async function saveSalonDraft(draft: Omit<SalonConsultationDraft, "version" | "savedAt">) {
  await writeDraft(SALON_DRAFT_KEY, { ...draft, version: 1, savedAt: Date.now() } satisfies SalonConsultationDraft);
}

export async function loadSalonDraft() {
  const draft = await readDraft<SalonConsultationDraft>(SALON_DRAFT_KEY);
  if (!isFresh(draft) || draft.version !== 1 || !draft.photo) {
    if (draft) await deleteDraft(SALON_DRAFT_KEY);
    return null;
  }
  return draft;
}

export function clearSalonDraft() {
  void deleteDraft(SALON_DRAFT_KEY);
}
