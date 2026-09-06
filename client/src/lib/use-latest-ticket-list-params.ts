import { useEffect, useRef } from "react";
import {
  serializeTicketListParams,
  type TicketListParams,
} from "./ticket-list-params";

/**
 * Tracks the most recent ticket-list params the page knows about, so a write can merge against them
 * rather than against the params its own render was built from.
 *
 * **Why this is needed.** `react-router` updates the browser URL synchronously via
 * `history.pushState` but defers its own React state update inside `startTransition`. Between those
 * two points the committed render is one write behind, so two writes issued from the same render both
 * merge into the same stale snapshot and the second silently discards the first. Choosing a status
 * filter and then clicking Next quickly produced `?page=2` with the filter gone (GH-3).
 *
 * **Why `setSearchParams`'s functional updater is not the answer.** It passes the same closed-over
 * render snapshot as `prev`, so two writes from one render receive identical `prev` and the clobber
 * survives untouched. Verified against `react-router@7.13.0`.
 *
 * **Why not `window.location.search`.** It is authoritative under `BrowserRouter`, but every
 * component test mounts `MemoryRouter`, which never touches it. Reading it would make the tests
 * exercise a path production does not use.
 *
 * The split this encodes: **render from the committed params, write from the latest params.**
 */
export function useLatestTicketListParams(committed: TicketListParams) {
  const latest = useRef(committed);
  /** The serialised form of the write we are waiting to see committed, or null when settled. */
  const pending = useRef<string | null>(null);

  // Only ever on a commit, never during render: a render discarded by a transition would otherwise
  // still have moved the ref.
  useEffect(() => {
    const committedSearch = serializeTicketListParams(committed).toString();

    if (pending.current === null) {
      // Nothing of ours is in flight, so the committed URL is the truth — this is what makes Back,
      // Forward, a reload and a hand-edited URL authoritative rather than pinned to an old write.
      latest.current = committed;
      return;
    }

    if (committedSearch === pending.current) {
      // Our write landed. `latest` already holds it.
      pending.current = null;
      latest.current = committed;
    }

    // Otherwise this commit is neither our pending write nor a settled state: the router has not
    // caught up yet, and adopting it here would discard the write we are still waiting on. That is
    // the whole defect, so it is left alone.
    //
    // Known bound, stated rather than hidden: if the URL changes from outside while one of our
    // writes is in flight and the outside change wins, `pending` never matches and this ref stays on
    // the value we wrote. It self-heals on the next write — that write merges onto a slightly stale
    // base once, which is no worse than the behaviour before this hook existed — and clears once a
    // write commits as issued.
  }, [committed]);

  return {
    /** The latest params known to the page: the last write if one is in flight, else the URL. */
    read: () => latest.current,
    /** Record what a write just sent, synchronously, so the next write merges onto it. */
    noteWritten: (written: TicketListParams) => {
      latest.current = written;
      pending.current = serializeTicketListParams(written).toString();
    },
  };
}
