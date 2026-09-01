// Shared allowlist for Argos practice + assessment pages.
// Source of truth: Google Sheet "Users" tab via Apps Script.

const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
const AUTH_CACHE_PREFIX = "argos_auth_";

let _lastAuthMessage = "";

function getAuthEndpoint() {
  if (typeof window !== "undefined" && window.SHEETS_ENDPOINT) {
    return window.SHEETS_ENDPOINT;
  }
  return "";
}

function getLastAuthMessage() {
  return _lastAuthMessage || "Unable to verify access. Please try again.";
}

function readAuthCache(email) {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_PREFIX + email);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !entry.user || !entry.expiresAt) return null;
    if (Date.now() > entry.expiresAt) {
      sessionStorage.removeItem(AUTH_CACHE_PREFIX + email);
      return null;
    }
    return entry.user;
  } catch {
    return null;
  }
}

function writeAuthCache(email, user) {
  try {
    sessionStorage.setItem(AUTH_CACHE_PREFIX + email, JSON.stringify({
      user,
      expiresAt: Date.now() + AUTH_CACHE_TTL_MS
    }));
  } catch (_) {}
}

function clearAuthCache(email) {
  try {
    if (email) {
      sessionStorage.removeItem(AUTH_CACHE_PREFIX + email);
      return;
    }
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith(AUTH_CACHE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (_) {}
}

async function lookupAllowedUser(email) {
  _lastAuthMessage = "";
  const key = (email || "").trim().toLowerCase();
  if (!key || !key.includes("@")) {
    _lastAuthMessage = "Please enter a valid email address.";
    return null;
  }

  const cached = readAuthCache(key);
  if (cached) {
    return cached;
  }

  const endpoint = getAuthEndpoint();
  if (!endpoint || endpoint.includes("PASTE_YOUR")) {
    _lastAuthMessage = "Access verification is not configured. Contact your trainer.";
    return null;
  }

  try {
    const url = endpoint + "?action=check_user&email=" + encodeURIComponent(key);
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      _lastAuthMessage = "Unable to verify access. Please try again.";
      return null;
    }

    const data = await res.json();
    if (!data || data.ok !== true) {
      _lastAuthMessage = (data && data.message) || "Unable to verify access. Please try again.";
      return null;
    }

    if (!data.allowed) {
      if (data.disabled) {
        _lastAuthMessage = "Your login access is currently disabled. Contact your trainer.";
      } else {
        _lastAuthMessage = "This email is not registered for training. Contact your trainer.";
      }
      clearAuthCache(key);
      return null;
    }

    const user = { email: key, name: data.name || key };
    writeAuthCache(key, user);
    return user;
  } catch (err) {
    console.error(err);
    _lastAuthMessage = "Unable to verify access. Check your connection and try again.";
    return null;
  }
}
