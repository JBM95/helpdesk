import { useMemo } from "react";
import { Link, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  type ColumnDef,
  type SortingState,
  type PaginationState,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { type Ticket } from "core/constants/ticket.ts";
import { categoryLabel } from "core/constants/ticket-category.ts";
import ErrorAlert from "@/components/ErrorAlert";
import StatusBadge from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { TicketSortField, TicketSortOrder } from "core/constants/ticket-sort.ts";
import {
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  type TicketListParams,
} from "@/lib/ticket-list-params";

interface TicketsResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}

// `listSearch` rides along in router state so the ticket-detail back link can return to the exact
// list the reader came from. It stays out of the detail URL deliberately: the detail page does not
// filter anything, and a reader who deep-links or reloads there simply gets a plain back link.
const buildColumns = (listSearch: string): ColumnDef<Ticket>[] => [
  {
    accessorKey: "subject",
    header: "Subject",
    cell: ({ row }) => (
      <Link
        to={`/tickets/${row.original.id}`}
        state={{ listSearch }}
        className="link font-medium"
      >
        {row.original.subject}
      </Link>
    ),
  },
  {
    accessorKey: "senderName",
    header: "Sender",
    cell: ({ row }) => (
      <div>
        <div>{row.original.senderName}</div>
        <div className="text-sm text-muted-foreground">
          {row.original.senderEmail}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) =>
      row.original.category ? (
        <Badge variant="secondary">
          {categoryLabel[row.original.category]}
        </Badge>
      ) : (
        "—"
      ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString(),
  },
];

const PAGE_SIZE = 10;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

interface TicketsTableProps {
  params: TicketListParams;
  onSortChange: (sortBy: TicketSortField, sortOrder: TicketSortOrder) => void;
  onPageChange: (page: number) => void;
}

export default function TicketsTable({
  params,
  onSortChange,
  onPageChange,
}: TicketsTableProps) {
  const { search: listSearch } = useLocation();
  const columns = useMemo(() => buildColumns(listSearch), [listSearch]);

  // Sorting and pagination are derived from the URL every render rather than held in state. That
  // is what lets browser history, a reload and a shared link all reproduce the same view — and it
  // is why there is no effect resetting the page when the filters change: the reset happens in
  // TicketsPage where the change is made, not in response to a new object reference here.
  const { status, category, search, sortBy, sortOrder, page } = params;

  // The API and the URL are 1-based; TanStack's pageIndex is 0-based.
  const sorting: SortingState = [{ id: sortBy, desc: sortOrder === "desc" }];
  const pagination: PaginationState = {
    pageIndex: page - 1,
    pageSize: PAGE_SIZE,
  };

  // Absent filters are omitted rather than sent as undefined keys, so the request the API receives
  // is byte-for-byte what it received before this change.
  //
  // The search term is trimmed here and only here. The URL and the input keep it verbatim, because
  // trimming on the way in is what stopped a space being typed at all; but a term that is only
  // whitespace is not a filter anyone meant, and sending it would match on a literal space. So the
  // reader sees what they typed and the API gets what they meant.
  const trimmedSearch = search?.trim();
  const filters = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(trimmedSearch ? { search: trimmedSearch } : {}),
  };

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tickets", sortBy, sortOrder, filters, pagination.pageIndex],
    queryFn: async () => {
      const { data } = await axios.get<TicketsResponse>("/api/tickets", {
        params: {
          sortBy,
          sortOrder,
          ...filters,
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        },
      });
      return data;
    },
  });

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / pagination.pageSize);
  const firstRowOnPage = pagination.pageIndex * pagination.pageSize + 1;
  // The page is URL-controllable now, so it can name a page past the end of the result set. Written
  // against pageCount rather than `total > 0` so a filter that matches nothing is covered too:
  // there, pageCount is 0 and every page above the first is out of range.
  const lastPage = Math.max(pageCount, 1);
  const isBeyondEnd = page > lastPage;

  const table = useReactTable({
    data: data?.tickets ?? [],
    columns,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const [first] = next;
      // A third click clears the sort in TanStack, which lands back on the default pair — the same
      // state the previous local-state implementation fell back to, and one the URL then omits.
      onSortChange(
        (first?.id as TicketSortField | undefined) ?? DEFAULT_SORT_BY,
        first === undefined
          ? DEFAULT_SORT_ORDER
          : first.desc
            ? "desc"
            : "asc"
      );
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater;
      onPageChange(next.pageIndex + 1);
    },
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    pageCount,
    getCoreRowModel: getCoreRowModel(),
  });

  if (error) {
    return <ErrorAlert message="Failed to fetch tickets" />;
  }

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {header.column.getIsSorted() === "asc" ? (
                      <ArrowUp className="ml-2 h-4 w-4" />
                    ) : header.column.getIsSorted() === "desc" ? (
                      <ArrowDown className="ml-2 h-4 w-4" />
                    ) : (
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    )}
                  </Button>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>

      {!isLoading && !error && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {isBeyondEnd
              ? `Page ${page} does not exist — ${plural(total, "ticket")} across ${plural(lastPage, "page")}`
              : total === 0
                ? "No tickets"
                : `Showing ${firstRowOnPage}–${Math.min(firstRowOnPage + pagination.pageSize - 1, total)} of ${total} tickets`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {isBeyondEnd ? (
              // Past the end, TanStack disables Next and Last as well as reporting "Page 99 of 5",
              // so without this the only way out is Previous ninety-four times or editing the URL.
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => onPageChange(lastPage)}
              >
                Go to last page
              </Button>
            ) : (
              <span className="text-sm px-2">
                Page {pagination.pageIndex + 1} of {pageCount || 1}
              </span>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
