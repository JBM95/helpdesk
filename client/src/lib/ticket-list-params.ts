import {
  agentTicketStatuses,
  type AgentTicketStatus,
} from "core/constants/ticket-status.ts";
import {
  ticketCategories,
  type TicketCategory,
} from "core/constants/ticket-category.ts";
import {
  sortableColumns,
  sortOrders,
  type TicketSortField,
  type TicketSortOrder,
} from "core/constants/ticket-sort.ts";

export const DEFAULT_SORT_BY: TicketSortField = "createdAt";
export const DEFAULT_SORT_ORDER: TicketSortOrder = "desc";
export const DEFAULT_PAGE = 1;

/**
 * The largest page that can be requested without breaking something downstream.
 *
 * `ticketListQuerySchema` only caps `page` at `MAX_SAFE_INTEGER`, but the route turns it into
 * `skip: (page - 1) * pageSize` and Prisma types `skip` as a 32-bit int. So the real ceiling is the
 * page whose skip still fits, and it is lower than the schema's by a wide margin.
 */
export const MAX_PAGE = Math.floor(2 ** 31 / 10);

export interface TicketListParams {
  status?: AgentTicketStatus;
  category?: TicketCategory;
  search?: string;
  sortBy: TicketSortField;
  sortOrder: TicketSortOrder;
  page: number;
}

/**
 * The allow-lists come from `core/constants/*`, so they are the same values
 * `ticketListQuerySchema` accepts server-side. Anything else is dropped here rather than sent:
 * the server answers an unsupported value with a 400, and TicketsTable turns any query error
 * into an error alert, so an unvalidated param blanks the list instead of degrading it.
 */
function oneOf<T extends readonly string[]>(
  allowed: T,
  value: string | null
): T[number] | undefined {
  if (value === null) return undefined;
  return (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}

function parsePage(value: string | null): number {
  if (value === null) return DEFAULT_PAGE;
  // Number, not parseInt: parseInt("1.5") is 1 and parseInt("2abc") is 2, so parseInt would
  // silently accept values the server's int() constraint rejects.
  const page = Number(value);
  // isSafeInteger, not isInteger. Zod's z.int() caps at Number.MAX_SAFE_INTEGER, so 1e21 is an
  // integer by isInteger's reckoning and `too_big` by the server's — it would 400 and blank the
  // list, which is the one thing this module exists to prevent. MAX_PAGE is the tighter of the two
  // ceilings, because Prisma's `skip` gives way before the schema does.
  return Number.isSafeInteger(page) && page >= DEFAULT_PAGE && page <= MAX_PAGE
    ? page
    : DEFAULT_PAGE;
}

/**
 * Reads the ticket-list view state out of the URL. Every unsupported, malformed or missing value
 * falls back to its default, so this never returns a state the tickets API would reject.
 *
 * Repeated keys resolve to the first value, because `URLSearchParams.get` returns the first —
 * `?status=open&status=closed` filters by `open` rather than sending both.
 */
export function parseTicketListParams(
  searchParams: URLSearchParams
): TicketListParams {
  // Deliberately NOT trimmed. The search input is controlled by this value, so trimming on read
  // while writing untrimmed means React restores the trimmed props value after each keystroke and
  // a typed space is discarded before the next character arrives — "vpn access" becomes
  // "vpnaccess". Absent means the param is missing or empty, nothing more. The server's
  // `search: z.string().optional()` does not trim either, so this matches it.
  const search = searchParams.get("search");

  return {
    status: oneOf(agentTicketStatuses, searchParams.get("status")),
    category: oneOf(ticketCategories, searchParams.get("category")),
    search: search ? search : undefined,
    sortBy: oneOf(sortableColumns, searchParams.get("sortBy")) ?? DEFAULT_SORT_BY,
    sortOrder:
      oneOf(sortOrders, searchParams.get("sortOrder")) ?? DEFAULT_SORT_ORDER,
    page: parsePage(searchParams.get("page")),
  };
}

/**
 * Writes the view state back to a query string, omitting anything that equals its default so the
 * default list is a bare `/tickets`.
 *
 * Sort is written as a pair: when either half is non-default both are emitted, so a URL that
 * mentions sorting at all says which column and which direction.
 */
export function serializeTicketListParams(
  params: TicketListParams
): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (params.status) searchParams.set("status", params.status);
  if (params.category) searchParams.set("category", params.category);
  if (params.search) searchParams.set("search", params.search);

  const sortIsDefault =
    params.sortBy === DEFAULT_SORT_BY && params.sortOrder === DEFAULT_SORT_ORDER;
  if (!sortIsDefault) {
    searchParams.set("sortBy", params.sortBy);
    searchParams.set("sortOrder", params.sortOrder);
  }

  if (params.page !== DEFAULT_PAGE) {
    searchParams.set("page", String(params.page));
  }

  return searchParams;
}

/** The filter subset, for the filter controls. */
export type TicketFilters = Pick<
  TicketListParams,
  "status" | "category" | "search"
>;
