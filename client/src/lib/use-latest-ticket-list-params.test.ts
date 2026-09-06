import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  DEFAULT_PAGE,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  type TicketListParams,
} from "./ticket-list-params";
import { useLatestTicketListParams } from "./use-latest-ticket-list-params";

const defaults: TicketListParams = {
  sortBy: DEFAULT_SORT_BY,
  sortOrder: DEFAULT_SORT_ORDER,
  page: DEFAULT_PAGE,
};

const withStatus: TicketListParams = { ...defaults, status: "open" };
const withStatusPage2: TicketListParams = { ...withStatus, page: 2 };
const withSort: TicketListParams = { ...defaults, sortBy: "subject", sortOrder: "asc" };

/**
 * GH-3, at the hook level. The race itself is guarded where it happens, on the page: see the two
 * "issued in the same render" tests in `TicketsPage.test.tsx`, which dispatch both events inside one
 * `act` and fail if the page stops using this hook.
 *
 * These tests cover the commit sequences that page-level events cannot address individually —
 * which commits are recognised as ours, and what happens when an outside navigation overtakes a
 * write in flight.
 */
describe("useLatestTicketListParams", () => {
  it("should start at the committed params", () => {
    const { result } = renderHook(() => useLatestTicketListParams(defaults));

    expect(result.current.read()).toEqual(defaults);
  });

  it("should return what was just written, before any re-render", () => {
    const { result } = renderHook(() => useLatestTicketListParams(defaults));

    result.current.noteWritten(withStatus);

    // No re-render has happened, so the committed params are still the defaults. This is the exact
    // moment the defect struck: a second write reading the render snapshot would see no status.
    expect(result.current.read()).toEqual(withStatus);
  });

  it("should compose two writes issued before either commits", () => {
    const { result } = renderHook(() => useLatestTicketListParams(defaults));

    // First write: a status filter, resetting the page.
    result.current.noteWritten({ ...result.current.read(), status: "open", page: DEFAULT_PAGE });
    // Second write, from the same committed render: page 2. It merges onto the first rather than
    // onto the snapshot, so the status survives — the whole point of GH-3.
    result.current.noteWritten({ ...result.current.read(), page: 2 });

    expect(result.current.read()).toEqual(withStatusPage2);
  });

  it("should keep the written params once the commit catches up", () => {
    const { result, rerender } = renderHook(
      ({ committed }) => useLatestTicketListParams(committed),
      { initialProps: { committed: defaults } }
    );

    result.current.noteWritten(withStatus);
    rerender({ committed: withStatus });

    expect(result.current.read()).toEqual(withStatus);
  });

  it("should adopt a committed change it did not write", () => {
    const { result, rerender } = renderHook(
      ({ committed }) => useLatestTicketListParams(committed),
      { initialProps: { committed: withStatus } }
    );

    // Back, Forward, a reload or a hand-edited URL: the URL moved to something this component did
    // not write, and it wins. Without this the ref would pin a stale view forever after one write.
    rerender({ committed: withSort });

    expect(result.current.read()).toEqual(withSort);
  });

  it("should adopt a later external change after one of its own writes settled", () => {
    const { result, rerender } = renderHook(
      ({ committed }) => useLatestTicketListParams(committed),
      { initialProps: { committed: defaults } }
    );

    result.current.noteWritten(withStatus);
    rerender({ committed: withStatus });
    // The write has settled, so nothing of ours is in flight any more and this Back must win. If the
    // queue were never drained the hook would ignore every navigation for the rest of its life.
    rerender({ committed: withSort });

    expect(result.current.read()).toEqual(withSort);
  });

  it("should let an external navigation overtake a write still in flight", () => {
    const { result, rerender } = renderHook(
      ({ committed }) => useLatestTicketListParams(committed),
      { initialProps: { committed: defaults } }
    );

    // A Back landing while our write is still in flight. The written value lost, so holding onto it
    // would make the next write resurrect a filter the reader has already navigated away from.
    result.current.noteWritten(withStatus);
    rerender({ committed: withSort });

    expect(result.current.read()).toEqual(withSort);
  });

  it("should not mistake a later navigation for an overtaken write of its own", () => {
    const { result, rerender } = renderHook(
      ({ committed }) => useLatestTicketListParams(committed),
      { initialProps: { committed: defaults } }
    );

    // Write, get overtaken, write again, then navigate back to the URL of that first overtaken write.
    // The overtaken write has to be forgotten at the moment it loses: left in the queue, this last
    // navigation is read as "our write landed" while a newer one is pending, and the reader's Back is
    // ignored.
    result.current.noteWritten(withStatus);
    rerender({ committed: withSort });
    result.current.noteWritten(withStatusPage2);
    rerender({ committed: withStatus });

    expect(result.current.read()).toEqual(withStatus);
  });

  it("should keep the newer write when the older of two in-flight writes commits first", () => {
    const { result, rerender } = renderHook(
      ({ committed }) => useLatestTicketListParams(committed),
      { initialProps: { committed: defaults } }
    );

    result.current.noteWritten(withStatus);
    result.current.noteWritten(withStatusPage2);
    // The router works through the queue in order, so the first commit is the older write. Adopting
    // it here would drop the page the reader asked for a moment later.
    rerender({ committed: withStatus });

    expect(result.current.read()).toEqual(withStatusPage2);

    rerender({ committed: withStatusPage2 });
    expect(result.current.read()).toEqual(withStatusPage2);
  });

  it("should treat an equal-but-new-identity committed object as unchanged", () => {
    const { result, rerender } = renderHook(
      ({ committed }) => useLatestTicketListParams(committed),
      { initialProps: { committed: defaults } }
    );

    result.current.noteWritten(withStatus);
    // `parseTicketListParams` returns a fresh object every render, so the effect sees a new identity
    // on every single render. Comparing by identity rather than by value would discard the pending
    // write on the very next render for no reason.
    rerender({ committed: { ...defaults } });

    expect(result.current.read()).toEqual(withStatus);
  });
});
