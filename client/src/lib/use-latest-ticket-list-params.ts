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
 * The split this encodes: **render from the committed params, write from the latest params** — and an
 * outside navigation always wins over a write still in flight.
 */
export function useLatestTicketListParams(committed: TicketListParams) {
  const latest = useRef(committed);
  /**
   * The serialised form of every write issued but not yet seen committed, oldest first.
   *
   * A queue rather than a single value, because the race this hook exists for issues two writes
   * before either commits: the first commit to arrive is not the newest, and a single slot would make
   * it unrecognisable as ours.
   */
  const pending = useRef<string[]>([]);
  /**
   * What the URL said at the previous commit.
   *
   * Needed because `parseTicketListParams` builds a fresh object every render, so this effect runs on
   * every render — including ones caused by something else entirely, such as a query resolving.
   * Without this, such a render is indistinguishable from an outside navigation and would discard a
   * write that is still perfectly in flight.
   */
  const lastCommitted = useRef(serializeTicketListParams(committed).toString());

  // Only ever on a commit, never during render: a render discarded by a transition would otherwise
  // still have moved the ref.
  useEffect(() => {
    const committedSearch = serializeTicketListParams(committed).toString();
    const previousSearch = lastCommitted.current;
    lastCommitted.current = committedSearch;

    const index = pending.current.indexOf(committedSearch);
    if (index !== -1) {
      // One of our writes landed. Drop it and everything it superseded. If a later write is still in
      // flight, `latest` already holds it and must not be pulled back to this older commit.
      pending.current = pending.current.slice(index + 1);
      if (pending.current.length === 0) {
        latest.current = committed;
      }
      return;
    }

    if (committedSearch === previousSearch) {
      // The URL has not moved, so this render came from elsewhere. Our pending writes are untouched.
      return;
    }

    // The URL moved to something we did not write: Back, Forward, a reload or a hand-edited URL, and
    // it wins. Anything of ours still queued has been overtaken, so it is dropped rather than left to
    // merge a filter the reader has navigated away from back in on the next write.
    pending.current = [];
    latest.current = committed;
  }, [committed]);

  return {
    /** The latest params known to the page: the last write if one is in flight, else the URL. */
    read: () => latest.current,
    /** Record what a write just sent, synchronously, so the next write merges onto it. */
    noteWritten: (written: TicketListParams) => {
      latest.current = written;
      pending.current = [
        ...pending.current,
        serializeTicketListParams(written).toString(),
      ];
    },
  };
}
