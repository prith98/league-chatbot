/**
 * Server-side current-patch lookup, backed by Riot's Data Dragon version feed.
 *
 * The client has its own copy of this in ddragon.ts as a React hook (for champion
 * icon URLs); that module is `"use client"`, so the server-rendered chat route
 * can't import it. This is the plain async equivalent used to anchor the model
 * to the live patch in the system prompt.
 */
const FALLBACK_VERSION = "16.11.1";
let cached: string | null = null;
let inflight: Promise<string> | null = null;

async function fetchLatestVersion(): Promise<string> {
  if (cached) return cached;
  if (!inflight) {
    inflight = fetch("https://ddragon.leagueoflegends.com/api/versions.json")
      .then((r) => r.json())
      .then((v: string[]) => (cached = v[0] ?? FALLBACK_VERSION))
      .catch(() => FALLBACK_VERSION);
  }
  return inflight;
}

/**
 * The current patch as players refer to it — "major.minor" (e.g. "15.1"),
 * derived from the full Data Dragon version (e.g. "15.1.1").
 */
export async function getCurrentPatch(): Promise<string> {
  const version = await fetchLatestVersion();
  const [major, minor] = version.split(".");
  return minor ? `${major}.${minor}` : version;
}
