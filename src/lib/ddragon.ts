"use client";

import { useEffect, useState } from "react";

/**
 * Riot's free static-data CDN. We only need the latest patch version to build
 * champion icon URLs. Champion names from match-v5 line up with Data Dragon IDs
 * for the vast majority of champions.
 */
const FALLBACK_VERSION = "15.1.1";
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

export function useDDragonVersion(): string {
  const [version, setVersion] = useState(cached ?? FALLBACK_VERSION);
  useEffect(() => {
    let active = true;
    fetchLatestVersion().then((v) => active && setVersion(v));
    return () => {
      active = false;
    };
  }, []);
  return version;
}

export function championIconUrl(championName: string, version: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`;
}
