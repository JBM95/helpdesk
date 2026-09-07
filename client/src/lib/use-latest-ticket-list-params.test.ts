import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { UNSAFE_NavigationContext } from "react-router";
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

type FakeNavigator = { location?: { search: string } };

/**
 * Provides a navigator directly rather than mounting a router, because these tests are about what the
 * hook does with the navigator it is handed — including the case where it carries no location, which no
 * real router produces.
 */
function withNavigator(navigator: FakeNavigator, children: ReactNode) {
  const value = { basename: "/", navigator, static: false };
  return createElement(
    UNSAFE_NavigationContext.Provider,
    { value: value as unknown as React.ContextType<typeof UNSAFE_NavigationContext> },
    children
  );
}

const withLiveLocation = (search: string, children: ReactNode) =>
  withNavigator({ location: { search } }, children);

const mutableNavigator = (search: string): Required<FakeNavigator> => ({
  location: { search },
});

/**
 * GH-3, at the hook level. The race itself is guarded where it happens, on the page: see the tests
 * under "GH-3, two writes issued before either commits" in `TicketsPage.test.tsx`, which dispatch both
 * events inside one `act` and fail if the page stops using this hook.
 *
 * What is left to test here is the contract this hook rests on — that it reads the router's live
 * location rather than the committed snapshot, that an empty live search means the bare list rather than
 * a missing location, and that it degrades to the committed params rather than throwing.
 *
 * **What these tests cannot catch, stated because an earlier version of this comment claimed otherwise.**
 * They inject a navigator directly, so they never exercise a real router. A react-router change that
 * removed the live `location` getter would fail the two page-level race tests in `TicketsPage.test.tsx`,
 * not anything here; a change of router *type* — `createBrowserRouter`, whose navigator carries no
 * `location` at all — would fail nothing in the suite and silently restore the GH-3 defect in
 * production. See the hook's own doc comment for the measured three-router table.
 */
describe("useLatestTicketListParams", () => {
  it("should read the live location, not the committed params", () => {
    // The committed params say page 1 with no filter; the live URL has already moved on. That gap is
    // exactly the window GH-3 lived in, and the whole point of this hook is to read the second one.
    const { result } = renderHook(() => useLatestTicketListParams(defaults), {
      wrapper: ({ children }) =>
        withLiveLocation("?status=open&page=2", children),
    });

    expect(result.current.read()).toEqual({
      ...defaults,
      status: "open",
      page: 2,
    });
  });

  it("should follow the live location when it changes without a re-render", () => {
    const navigator = mutableNavigator("?status=open");
    const { result } = renderHook(() => useLatestTicketListParams(defaults), {
      wrapper: ({ children }) => withNavigator(navigator, children),
    });

    expect(result.current.read()).toMatchObject({ status: "open" });

    // `pushState` has been applied but React has not committed: a second write in the same render must
    // see this, or it merges onto the stale snapshot and discards the first write.
    navigator.location.search = "?status=open&page=2";

    expect(result.current.read()).toMatchObject({ status: "open", page: 2 });
  });

  it("should read an empty live search as the bare list, not as a missing location", () => {
    // The distinguishing case for the fallback condition, and the reason it tests `=== undefined`
    // rather than falsiness: an empty search is a real URL — the unfiltered list — while the committed
    // params still carry the filter the reader has just left by a Back. A falsy check returns
    // `committed` here, and the next write merges onto that filter and resurrects it.
    const { result } = renderHook(
      () => useLatestTicketListParams({ ...defaults, status: "open", page: 2 }),
      { wrapper: ({ children }) => withLiveLocation("", children) }
    );

    expect(result.current.read()).toEqual(defaults);
  });

  it("should fall back to the committed params when the navigator exposes no location", () => {
    // `UNSAFE_NavigationContext` is a private export and a live `location` on its navigator is not a
    // documented guarantee. If an upgrade removes it, this hook must degrade to the committed snapshot
    // — the pre-fix behaviour — rather than throw.
    const { result } = renderHook(() => useLatestTicketListParams(defaults), {
      wrapper: ({ children }) => withNavigator({}, children),
    });

    expect(result.current.read()).toEqual(defaults);
  });
});
