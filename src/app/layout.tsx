import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

/* Three faces, three jobs — the split is the type system.
   Bricolage carries the voice (wordmark, headlines) and is used sparingly.
   Instrument Sans is everything a person reads as language.
   Plex Mono is everything a person reads as a measurement. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const plex = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rift Analyst — scouting reports for League of Legends",
  description:
    "Scout any League of Legends player, matchup, or team draft. Live records from the Riot API and current-patch meta from OP.GG, read against each role's own average.",
  applicationName: "Rift Analyst",
};

export const viewport: Viewport = {
  themeColor: "#0b0e14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrument.variable} ${plex.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
