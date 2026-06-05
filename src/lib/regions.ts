/**
 * Riot routing tables — shared between the server (riot.ts) and the client
 * (the compare modal in page.tsx). This file has no server-only imports so it
 * is safe to pull into a "use client" component.
 *
 * Riot uses two routing schemes:
 *  - PLATFORM routing (na1, euw1, kr, ...) for summoner-v4 / league-v4
 *  - REGIONAL routing (americas, europe, asia) for account-v1 / match-v5
 */
export const PLATFORM_TO_REGION: Record<string, "americas" | "europe" | "asia"> = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  oc1: "americas",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  kr: "asia",
  jp1: "asia",
};

/** All supported platform codes. The single source of truth for both the
 * server-side Zod enum and the client-side region picker. */
export const PLATFORMS = Object.keys(PLATFORM_TO_REGION) as [string, ...string[]];
