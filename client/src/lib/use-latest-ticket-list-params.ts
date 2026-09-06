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
 * navigator exposing a live `location` is not a documented guarantee. Two things contain that: the read
 * falls back to the committed params when no live location is present, so an upgrade that removes it
 * degrades to the old snapshot behaviour rather than crashing; and
 * `use-latest-ticket-list-params.test.ts` asserts the live read directly, so an upgrade that breaks it
 * fails a test that names this file instead of surfacing as a URL bug months later.
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
      if (live?.search === undefined) return committed;
      return parseTicketListParams(new URLSearchParams(live.search));
    },
  };
}
