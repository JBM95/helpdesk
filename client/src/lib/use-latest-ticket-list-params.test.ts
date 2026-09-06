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
 * GH-3. This hook exists because the race it guards cannot be reproduced in the component suite:
 * React Testing Library's act environment flushes react-router's transition synchronously between
 * two events, so the second write always sees fresh params in jsdom. Measured, not assumed — a probe
 * showed the URL already committed immediately after the first `fireEvent`.
 *
 * In a real browser the transition is deferred, so the window is real. Driving `committed` by hand
 * here is the only way to exercise the sequence that produces the defect.
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
