import { useSearchParams } from "react-router";
import {
  DEFAULT_PAGE,
  parseTicketListParams,
  serializeTicketListParams,
  type TicketFilters,
  type TicketListParams,
} from "@/lib/ticket-list-params";
import type { TicketSortField, TicketSortOrder } from "core/constants/ticket-sort.ts";
import TicketsTable from "./TicketsTable";
import TicketsFilters from "./TicketsFilters";

export default function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // The URL is the source of truth: nothing about the view is held in component state, so a
  // remount, a reload and a history entry all produce the same list.
  const params = parseTicketListParams(searchParams);
  const filters: TicketFilters = {
    status: params.status,
    category: params.category,
    search: params.search,
  };

  function write(next: TicketListParams, replace = false) {
    setSearchParams(serializeTicketListParams(next), { replace });
  }

  function handleFiltersChange(nextFilters: TicketFilters) {
    // Starting a search pushes, refining one replaces. Every keystroke is a new URL, so pushing
    // each would put one history entry per character and Back would walk the reader through
    // "logi", "log", "lo". Replacing every edit instead would mean Back never undid the search at
    // all. Pushing only the first edit gives a search session exactly one entry, so one Back
    // returns to the list as it was before the search. Status and category are discrete choices
    // and always push.
    // Clearing the box is excluded: it is the end of the search, not a refinement of it. Replacing
    // there would overwrite the search entry with the same URL as the entry before it, and the
    // reader's first Back would appear to do nothing.
    const refiningExistingSearch =
      params.search !== undefined &&
      nextFilters.search !== undefined &&
      nextFilters.search !== params.search &&
      nextFilters.status === params.status &&
      nextFilters.category === params.category;

    // Narrowing the list makes the current page meaningless, so pagination resets here — at the
    // point the user changed something — rather than being inferred from a changed reference.
    write(
      { ...params, ...nextFilters, page: DEFAULT_PAGE },
      refiningExistingSearch
    );
  }

  function handleSortChange(
    sortBy: TicketSortField,
    sortOrder: TicketSortOrder
  ) {
    write({ ...params, sortBy, sortOrder, page: DEFAULT_PAGE });
  }

  function handlePageChange(page: number) {
    write({ ...params, page });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
      </div>
      <TicketsFilters filters={filters} onChange={handleFiltersChange} />
      <TicketsTable
        params={params}
        onSortChange={handleSortChange}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
