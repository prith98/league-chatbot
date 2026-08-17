import { notFound } from "next/navigation";
import { PreviewBoard } from "./PreviewBoard";

/**
 * Visual preview harness — development only.
 *
 * The report cards are the bulk of this app's surface area and they only appear
 * after a live agent run. This route renders every one of them from synthetic
 * fixtures so layout, density and breakpoints can be checked in one pass,
 * without spending Riot rate limit on each iteration.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PreviewBoard />;
}
