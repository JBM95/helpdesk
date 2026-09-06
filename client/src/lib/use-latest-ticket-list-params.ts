import { useContext } from "react";
import { UNSAFE_NavigationContext } from "react-router";
import {
  parseTicketListParams,
  type TicketListParams,
} from "./ticket-list-params";

/**
 * Reads the ticket-list params from the router's **live** location, so a write merges against the URL
 * as it is right now rather than against the params its own render was built from.
 *
 * **Why this is needed.** `react-router` updates the URL synchronously via `history.pushState` but
 * defers its own React state update inside `startTransition`. Between those two points the committed
 * render is one write behind, so two writes issued from the same render both merge into the same stale
 * snapshot and the second silently discards the first. Choosing a status filter and then clicking Next
 * quickly produced `?page=2` with the filter gone (GH-3).
 *
 * **Why `setSearchParams`'s functional updater is not the answer.** It passes the same closed-over
 * render snapshot as `prev`, so two writes from one render receive identical `prev` and the clobber
 * survives untouched. Verified against `react-router@7.13.0`.
 *
 * **Why not track the pending write instead.** That was the first implementation, and it cannot be made
 * correct. A Back that returns to the exact entry an in-flight write was issued from leaves the
 * committed search, `location.key` and `useNavigationType()` all unchanged — measured, not assumed — so
 * an abandoned write is indistinguishable from one still in flight. Tracking made the next write
 * resurrect the filter the reader had just navigated away from.
 *
 * **Why not `window.location.search`.** It is authoritative under `BrowserRouter`, but every component
 * test mounts `MemoryRouter`, which never touches it. The navigator below is authoritative under both.
 *
 * **The cost, stated plainly.** `UNSAFE_NavigationContext` is a private react-router export, and its
 * navigator exposing a live `location` is not a documented guarantee. The read falls back to the
 * committed params when no live location is present, so an upgrade that removes it degrades to the old
 * snapshot behaviour rather than crashing, and `use-latest-ticket-list-params.test.ts` asserts the live
 * read directly.
 *
 * **What that does not cover.** Under `react-router@7.13.0`, `BrowserRouter` and `MemoryRouter` both hand
 * over a history whose `location` is a live getter, but `RouterProvider` — `createBrowserRouter` — hands
 * over a navigator with no `location` at all. Moving this app to a data router would therefore take the
 * fallback in production and silently restore the GH-3 defect, while every component test kept mounting
 * `MemoryRouter` and stayed green. The tests below cannot see it: they inject a navigator rather than
 * mounting a router. If you are here to migrate the router, this hook is the thing to re-verify first.
 */
export function useLatestTicketListParams(committed: TicketListParams) {
  const { navigator } = useContext(UNSAFE_NavigationContext);

  return {
    /**
     * The params the URL holds right now: any write already applied via `pushState`, plus any history
     * navigation the reader has made, whether or not React has committed either yet.
     */
    read: (): TicketListParams => {
      const live = (navigator as { location?: { search?: string } }).location;
      // `=== undefined`, not a falsy check. An empty search is a real URL — the bare `/tickets` list —
      // and a reader reaches it by clearing a filter or by a Back onto the unfiltered entry. Treating
      // it as "no live location" would fall back to the committed params and merge the next write onto
      // the filter they just left, which is the round-2 regression this hook was built to end.
      if (live?.search === undefined) return committed;
      return parseTicketListParams(new URLSearchParams(live.search));
    },
  };
}
