/**
 * The one piece of AMFI logic both sides need.
 *
 * The category filter is applied on the server (over all ~14k schemes) while
 * the table renders the resulting page — so the two must normalise the category
 * string identically or picking a category would match nothing. Keeping it in
 * its own module means the Markets view can import it without pulling
 * lib/amfi.ts, and its NAV-feed fetching and parsing, into the client bundle.
 */

/**
 * AMFI writes the category as a sentence: "Open Ended Schemes (Equity Scheme -
 * Large Cap Fund)". The part in brackets is the only bit that distinguishes one
 * scheme from another, so that is what we show and filter on.
 */
export function cleanFundCategory(c: string): string {
  const m = c.match(/\(([^)]+)\)/);
  return (m ? m[1] : c).trim();
}
