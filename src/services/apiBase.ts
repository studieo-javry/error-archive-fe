/**
 * Single source of truth for the API origin.
 *
 * Unset (local dev) → relative `/api/v1`, which `vite.config.ts` proxies to localhost:8000.
 * Set at build time (CI) → absolute origin, e.g. https://api.error-archive.com/api/v1.
 *
 * `||` rather than `??` on purpose: `.env.example` ships the key with an empty value, and an
 * empty string must fall back to the relative path instead of collapsing the base to ''.
 *
 * Both the axios client and the notification EventSource must read from here. EventSource does
 * not go through axios, so a hardcoded path there would silently ignore the configured origin.
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'
