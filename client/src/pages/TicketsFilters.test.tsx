import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import "@/test/pointer-events";
import type { TicketFilters } from "@/lib/ticket-list-params";
import TicketsFilters from "./TicketsFilters";

/**
 * The delta contract, control by control.
 *
 * Each control must report only the key it owns. `filters` below is the *committed* set, so a control
 * that spread it would send the other two keys as they were one render ago, and the page would merge
 * those stale values over a write another control had just landed — the GH-3 defect, one level above the
 * hook that fixes the rest of it (`FIND-86cc706fc23c`, and round 3's B-R3-3).
 *
 * This is tested here rather than only through the page because the compiler cannot hold it: every field
 * of `TicketFilters` is optional, so a delta and a full set are the same type. It is tested for **every**
 * control rather than the two that happened to have page-level race tests, because round 4 shipped with
 * the category control unguarded and the suite stayed green.
 *
 * `TicketsPage.test.tsx` → "GH-3, two writes issued before either commits" covers the user-visible
 * consequence; this covers the cause.
 */
describe("TicketsFilters — each control reports only the key it owns", () => {
  /** A committed set with all three filters set, so a spread of it is visible in the payload. */
  const committed: TicketFilters = {
    status: "open",
    category: "refund_request",
    search: "vpn",
  };

  function renderFilters() {
    const onChange = vi.fn();
    render(<TicketsFilters filters={committed} onChange={onChange} />);
    return onChange;
  }

  /**
   * Asserts the payload is exactly one key, by name as well as by value.
   *
   * The key-name half is not redundant. `toEqual` semantics ignore keys whose value is `undefined`, so
   * a control emitting `{ category: "x", status: undefined }` satisfies a value-only assertion while
   * still carrying a second key — and `status: undefined` is not inert here, because the page spreads
   * the delta and a present-but-undefined key clears that filter. Value-only assertions caught the
   * whole-set spread but not that narrower case.
   */
  function expectSoleKey(
    onChange: ReturnType<typeof vi.fn>,
    key: keyof TicketFilters,
    value: TicketFilters[keyof TicketFilters]
  ) {
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ [key]: value });
    expect(Object.keys(onChange.mock.calls[0][0])).toEqual([key]);
  }

  /** The two filter Selects are comboboxes in render order: status, then category. */
  const trigger = (index: number) => screen.getAllByRole("combobox")[index];

  it("should report a search edit as the search key alone", async () => {
    const user = userEvent.setup();
    const onChange = renderFilters();

    await user.type(screen.getByPlaceholderText("Search tickets..."), "!");

    expectSoleKey(onChange, "search", "vpn!");
  });

  it("should report a cleared search as the search key alone", async () => {
    const user = userEvent.setup();
    const onChange = renderFilters();

    await user.clear(screen.getByPlaceholderText("Search tickets..."));

    // `undefined` on a key that is present is how a filter is cleared: the page spreads the delta, so a
    // present-but-undefined key overwrites, while an absent key would leave the old value in place.
    expectSoleKey(onChange, "search", undefined);
  });

  it("should report a status choice as the status key alone", async () => {
    const user = userEvent.setup();
    const onChange = renderFilters();

    await user.click(trigger(0));
    await user.click(await screen.findByRole("option", { name: "Closed" }));

    expectSoleKey(onChange, "status", "closed");
  });

  it("should report a cleared status as the status key alone", async () => {
    const user = userEvent.setup();
    const onChange = renderFilters();

    await user.click(trigger(0));
    await user.click(await screen.findByRole("option", { name: "All statuses" }));

    expectSoleKey(onChange, "status", undefined);
  });

  it("should report a category choice as the category key alone", async () => {
    const user = userEvent.setup();
    const onChange = renderFilters();

    await user.click(trigger(1));
    await user.click(
      await screen.findByRole("option", { name: "General question" })
    );

    expectSoleKey(onChange, "category", "general_question");
  });

  it("should report a cleared category as the category key alone", async () => {
    const user = userEvent.setup();
    const onChange = renderFilters();

    await user.click(trigger(1));
    await user.click(
      await screen.findByRole("option", { name: "All categories" })
    );

    expectSoleKey(onChange, "category", undefined);
  });
});
