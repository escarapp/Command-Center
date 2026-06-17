export const ACTIVE_PROJECT_ID_COOKIE = "rgv_active_project_id";
export const ACTIVE_PROJECT_NAME_COOKIE = "rgv_active_project_name";

export type ActiveProjectSelection = {
  id: string;
  name: string;
};

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!match) return null;

  const value = match.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}

export function setActiveProjectSelection(selection: ActiveProjectSelection) {
  if (typeof document === "undefined") return;

  writeCookie(ACTIVE_PROJECT_ID_COOKIE, selection.id);
  writeCookie(ACTIVE_PROJECT_NAME_COOKIE, selection.name);

  try {
    window.localStorage.setItem(ACTIVE_PROJECT_ID_COOKIE, selection.id);
    window.localStorage.setItem(ACTIVE_PROJECT_NAME_COOKIE, selection.name);
  } catch {
    // Ignore localStorage errors in restricted browser contexts.
  }
}

export function clearActiveProjectSelection() {
  if (typeof document === "undefined") return;

  document.cookie = `${ACTIVE_PROJECT_ID_COOKIE}=; path=/; max-age=0; samesite=lax`;
  document.cookie = `${ACTIVE_PROJECT_NAME_COOKIE}=; path=/; max-age=0; samesite=lax`;

  try {
    window.localStorage.removeItem(ACTIVE_PROJECT_ID_COOKIE);
    window.localStorage.removeItem(ACTIVE_PROJECT_NAME_COOKIE);
  } catch {
    // Ignore localStorage errors in restricted browser contexts.
  }
}

export function readActiveProjectSelection(): ActiveProjectSelection | null {
  const id = readCookie(ACTIVE_PROJECT_ID_COOKIE);
  const name = readCookie(ACTIVE_PROJECT_NAME_COOKIE);

  if (id && name) return { id, name };

  if (typeof window === "undefined") return null;

  try {
    const storedId = window.localStorage.getItem(ACTIVE_PROJECT_ID_COOKIE);
    const storedName = window.localStorage.getItem(ACTIVE_PROJECT_NAME_COOKIE);
    if (storedId && storedName) return { id: storedId, name: storedName };
  } catch {
    // Ignore localStorage errors in restricted browser contexts.
  }

  return null;
}