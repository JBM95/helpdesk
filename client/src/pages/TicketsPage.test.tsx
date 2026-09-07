import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render";
import TicketsPage from "./TicketsPage";
import TicketsTable from "./TicketsTable";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

// Radix Select relies on pointer capture APIs not available in jsdom.
// Copied from TicketDetailPage.test.tsx:13-28 — the Clear filters cases are the
// first in this file to drive the status and category dropdowns.
class MockPointerEvent extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;
  constructor(type: string, props: PointerEventInit & { pointerType?: string } = {}) {
    super(type, props);
    this.button = props.button ?? 0;
    this.ctrlKey = props.ctrlKey ?? false;
    this.pointerType = props.pointerType ?? "mouse";
  }
}
window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.setPointerCapture = vi.fn();

const mockTickets = [
  {
    id: 1,
    subject: "Cannot login to my account",
    status: "open",
    category: "technical_question",
    senderName: "Alice Smith",
    senderEmail: "alice@example.com",
    createdAt: "2025-03-01T10:00:00.000Z",
  },
  {
    id: 2,
    subject: "Refund for order #123",
    status: "resolved",
    category: "refund_request",
    senderName: "Bob Jones",
    senderEmail: "bob@example.com",
    createdAt: "2025-02-28T08:00:00.000Z",
  },
  {
    id: 3,
    subject: "How do I reset my password?",
    status: "closed",
    category: null,
    senderName: "Charlie Brown",
    senderEmail: "charlie@example.com",
    createdAt: "2025-02-27T14:00:00.000Z",
  },
];

function mockResponse(tickets = mockTickets, total = tickets.length) {
  return { data: { tickets, total, page: 1, pageSize: 10 } };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("TicketsPage", () => {
  it("should show skeleton rows while loading", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<TicketsPage />);

    expect(screen.getByText("Tickets")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Subject/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sender/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Status/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Category/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Created/ })).toBeInTheDocument();
    expect(document.querySelector("[data-slot='skeleton']")).toBeInTheDocument();
  });

  it("should display tickets in a table after loading", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse());
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Cannot login to my account")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Refund for order #123")).toBeInTheDocument();
    expect(
      screen.getByText("How do I reset my password?")
    ).toBeInTheDocument();
    expect(
      document.querySelector("[data-slot='skeleton']")
    ).not.toBeInTheDocument();
  });

  it("should display sender name and email", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse());
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("should display status badges", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse());
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Open")).toBeInTheDocument();
    });

    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("should display category using category labels", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse());
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Technical")).toBeInTheDocument();
    });

    expect(screen.getByText("Refund")).toBeInTheDocument();
  });

  it("should show dash for null category", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse());
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("How do I reset my password?")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("should format createdAt as a locale date string", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse([mockTickets[0]]));
    renderWithQuery(<TicketsPage />);

    const expectedDate = new Date(
      "2025-03-01T10:00:00.000Z"
    ).toLocaleDateString();
    await waitFor(() => {
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
    });
  });

  it("should show an error alert when the request fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network Error"));
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to fetch tickets")
      ).toBeInTheDocument();
    });
  });

  it("should not show the table when there is an error", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network Error"));
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to fetch tickets")
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("should render an empty table body when there are no tickets", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse([], 0));
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(
        document.querySelector("[data-slot='skeleton']")
      ).not.toBeInTheDocument();
    });

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(1); // header row only
    expect(screen.getByText("No tickets")).toBeInTheDocument();
  });

  it("should call axios.get with default sort and pagination params", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse([], 0));
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
        params: {
          sortBy: "createdAt",
          sortOrder: "desc",
          page: 1,
          pageSize: 10,
        },
      });
    });
  });

  it("should sort by column when clicking a column header", async () => {
    const user = userEvent.setup();
    mockedAxios.get.mockResolvedValue(mockResponse());
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Cannot login to my account")
      ).toBeInTheDocument();
    });

    mockedAxios.get.mockClear();
    mockedAxios.get.mockResolvedValue(mockResponse());

    await user.click(screen.getByRole("button", { name: /Subject/ }));

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({
          sortBy: "subject",
          sortOrder: "asc",
          page: 1,
        }),
      });
    });
  });

  it("should toggle sort order when clicking the same column header twice", async () => {
    const user = userEvent.setup();
    mockedAxios.get.mockResolvedValue(mockResponse());
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Cannot login to my account")
      ).toBeInTheDocument();
    });

    mockedAxios.get.mockClear();
    mockedAxios.get.mockResolvedValue(mockResponse());

    await user.click(screen.getByRole("button", { name: /Subject/ }));

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({
          sortBy: "subject",
          sortOrder: "asc",
        }),
      });
    });

    mockedAxios.get.mockClear();
    mockedAxios.get.mockResolvedValue(mockResponse());

    await user.click(screen.getByRole("button", { name: /Subject/ }));

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({
          sortBy: "subject",
          sortOrder: "desc",
        }),
      });
    });
  });

  it("should render the search input and filter dropdowns", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<TicketsPage />);

    expect(
      screen.getByPlaceholderText("Search tickets...")
    ).toBeInTheDocument();
    expect(screen.getByText("All statuses")).toBeInTheDocument();
    expect(screen.getByText("All categories")).toBeInTheDocument();
  });

  it("should send search param when typing in the search input", async () => {
    const user = userEvent.setup();
    mockedAxios.get.mockResolvedValue(mockResponse());
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Cannot login to my account")
      ).toBeInTheDocument();
    });

    mockedAxios.get.mockClear();
    mockedAxios.get.mockResolvedValue(mockResponse([mockTickets[0]]));

    await user.type(
      screen.getByPlaceholderText("Search tickets..."),
      "login"
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({ search: "login" }),
      });
    });
  });

  it("should include status filter in API request", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse([mockTickets[0]]));
    renderWithQuery(<TicketsTable filters={{ status: "open" }} />);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({ status: "open" }),
      });
    });
  });

  it("should include category filter in API request", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse([mockTickets[1]]));
    renderWithQuery(<TicketsTable filters={{ category: "refund_request" }} />);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({ category: "refund_request" }),
      });
    });
  });

  it("should include search filter in API request", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse([mockTickets[0]]));
    renderWithQuery(<TicketsTable filters={{ search: "login" }} />);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({ search: "login" }),
      });
    });
  });

  it("should display pagination info and controls", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Showing 1–10 of 50 tickets")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Previous page" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Next page" })
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Last page" })).toBeEnabled();
  });

  it("should fetch page 2 when clicking the next page button", async () => {
    const user = userEvent.setup();
    mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Showing 1–10 of 50 tickets")
      ).toBeInTheDocument();
    });

    mockedAxios.get.mockClear();
    mockedAxios.get.mockResolvedValue({
      data: { tickets: mockTickets, total: 50, page: 2, pageSize: 10 },
    });

    await user.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({ page: 2, pageSize: 10 }),
      });
    });
  });

  it("should disable all pagination buttons on the last page", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 3));
    renderWithQuery(<TicketsPage />);

    await waitFor(() => {
      expect(screen.getByText("Showing 1–3 of 3 tickets")).toBeInTheDocument();
    });

    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Previous page" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Last page" })).toBeDisabled();
  });


  // Cases below map 1:1 onto the approved case set in
  // .solvo/testplans/GH-4-cases.md. The CASE ids are kept so QA verification can
  // associate evidence with a specific AC rather than with the suite as a whole.
  describe("Clear filters", () => {
    const CLEAR = { name: /clear filters/i } as const;
    const searchBox = () => screen.getByPlaceholderText("Search tickets...");

    type User = ReturnType<typeof userEvent.setup>;

    async function pickStatus(user: User, label: string) {
      await user.click(screen.getAllByRole("combobox")[0]);
      await user.click(await screen.findByRole("option", { name: label }));
    }

    async function pickCategory(user: User, label: string) {
      await user.click(screen.getAllByRole("combobox")[1]);
      await user.click(await screen.findByRole("option", { name: label }));
    }

    async function renderLoaded(total?: number) {
      mockedAxios.get.mockResolvedValue(
        total === undefined ? mockResponse() : mockResponse(mockTickets, total)
      );
      renderWithQuery(<TicketsPage />);
      await waitFor(() => {
        expect(
          screen.getByText("Cannot login to my account")
        ).toBeInTheDocument();
      });
    }

    describe("AC1 — visible when needed", () => {
      // The three single-filter cases each prove a different disjunct of
      // "at least one of": a predicate written `search || status` passes the
      // search case and fails the category case.
      it("CASE-97bd394b8d4b: is visible when only a search term is active", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.type(searchBox(), "login");

        expect(screen.getByRole("button", CLEAR)).toBeInTheDocument();
      });

      it("CASE-f1048c79850a: is visible when only a status filter is active", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await pickStatus(user, "Open");

        expect(screen.getByRole("button", CLEAR)).toBeInTheDocument();
      });

      it("CASE-3b0e40c8bf4e: is visible when only a category filter is active", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await pickCategory(user, "Refund request");

        expect(screen.getByRole("button", CLEAR)).toBeInTheDocument();
      });

      it("CASE-20df8cc073c5: is visible with search, status and category all active", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.type(searchBox(), "login");
        await pickStatus(user, "Open");
        await pickCategory(user, "Technical question");

        expect(screen.getByRole("button", CLEAR)).toBeInTheDocument();
      });

      // The search input writes `e.target.value || undefined`, so a single space
      // is truthy and lands in filters.search — an active filter, not a default.
      it("CASE-538c67330f0d: is visible when the search term is whitespace only", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.type(searchBox(), " ");

        expect(screen.getByRole("button", CLEAR)).toBeInTheDocument();
      });
    });

    describe("AC2 — hidden at defaults", () => {
      it("CASE-c26b837c3ed5: is absent on initial mount", async () => {
        await renderLoaded();

        expect(screen.queryByRole("button", CLEAR)).not.toBeInTheDocument();
      });

      // The "" versus undefined asymmetry: visibility computed by truthiness over
      // a "" written by a Clear handler would stay visible here.
      it("CASE-b1ca237fc00c: is absent again after the search box is emptied", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.type(searchBox(), "login");
        expect(screen.getByRole("button", CLEAR)).toBeInTheDocument();

        await user.clear(searchBox());

        expect(screen.queryByRole("button", CLEAR)).not.toBeInTheDocument();
      });

      it("CASE-d13a64090439: is absent again after status returns to All statuses", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await pickStatus(user, "Open");
        expect(screen.getByRole("button", CLEAR)).toBeInTheDocument();

        await pickStatus(user, "All statuses");

        expect(screen.queryByRole("button", CLEAR)).not.toBeInTheDocument();
      });

      it("CASE-dc3567d08fee: hides itself once activated", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.type(searchBox(), "login");
        await user.click(screen.getByRole("button", CLEAR));

        expect(screen.queryByRole("button", CLEAR)).not.toBeInTheDocument();
      });
    });

    describe("AC3 — clear all filter controls together", () => {
      it("CASE-151947322ff2: resets all three controls to their defaults", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.type(searchBox(), "login");
        await pickStatus(user, "Open");
        await pickCategory(user, "Technical question");

        await user.click(screen.getByRole("button", CLEAR));

        const [status, category] = screen.getAllByRole("combobox");
        expect(searchBox()).toHaveValue("");
        expect(status).toHaveTextContent("All statuses");
        expect(category).toHaveTextContent("All categories");
      });

      // Retained as the one AC3 case needing no PointerEvent polyfill, so the AC
      // does not rest entirely on this suite's least-exercised harness.
      it("CASE-54299e624f39: empties the search box and leaves both selects at defaults", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.type(searchBox(), "login");
        await user.click(screen.getByRole("button", CLEAR));

        const [status, category] = screen.getAllByRole("combobox");
        expect(searchBox()).toHaveValue("");
        expect(status).toHaveTextContent("All statuses");
        expect(category).toHaveTextContent("All categories");
      });
    });

    describe("AC4 — unfiltered refresh", () => {
      // Full-object equality, not objectContaining: the claim is that
      // search/status/category are absent, and containment cannot prove absence.
      it("CASE-39d9087d45f6: the post-clear request carries exactly the sort and pagination params", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.type(searchBox(), "login");
        await pickStatus(user, "Open");
        await pickCategory(user, "Technical question");

        mockedAxios.get.mockClear();
        mockedAxios.get.mockResolvedValue(mockResponse());

        await user.click(screen.getByRole("button", CLEAR));

        await waitFor(() => {
          expect(mockedAxios.get).toHaveBeenLastCalledWith("/api/tickets", {
            params: {
              sortBy: "createdAt",
              sortOrder: "desc",
              page: 1,
              pageSize: 10,
            },
          });
        });
      });

      it("CASE-379746876d93: the unfiltered ticket rows are displayed after clearing", async () => {
        const user = userEvent.setup();
        mockedAxios.get.mockResolvedValue(mockResponse([mockTickets[0]]));
        renderWithQuery(<TicketsPage />);

        await waitFor(() => {
          expect(
            screen.getByText("Cannot login to my account")
          ).toBeInTheDocument();
        });

        await user.type(searchBox(), "login");

        await waitFor(() => {
          expect(
            screen.queryByText("Refund for order #123")
          ).not.toBeInTheDocument();
        });

        mockedAxios.get.mockResolvedValue(mockResponse());

        await user.click(screen.getByRole("button", CLEAR));

        await waitFor(() => {
          expect(
            screen.getByText("Refund for order #123")
          ).toBeInTheDocument();
        });
        expect(
          screen.getByText("Cannot login to my account")
        ).toBeInTheDocument();
        expect(
          screen.getByText("How do I reset my password?")
        ).toBeInTheDocument();
      });

      // `search: ""` would spread into TicketsTable.tsx:122-128 and put ?search=
      // on the wire, which AC4 forbids.
      it("CASE-3af1d27a0741: the post-clear request omits the search param entirely", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.type(searchBox(), "login");

        await waitFor(() => {
          expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
            params: expect.objectContaining({ search: "login" }),
          });
        });

        mockedAxios.get.mockClear();
        mockedAxios.get.mockResolvedValue(mockResponse());

        await user.click(screen.getByRole("button", CLEAR));

        await waitFor(() => {
          expect(mockedAxios.get).toHaveBeenLastCalledWith("/api/tickets", {
            params: {
              sortBy: "createdAt",
              sortOrder: "desc",
              page: 1,
              pageSize: 10,
            },
          });
        });

        const lastParams = mockedAxios.get.mock.calls.at(-1)?.[1]?.params;
        expect(lastParams).not.toHaveProperty("search");
        expect(lastParams).not.toHaveProperty("status");
        expect(lastParams).not.toHaveProperty("category");
      });

      it("CASE-f1ab5d0941fc: a failed post-clear refetch shows the error and leaves filters cleared", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.type(searchBox(), "login");

        await waitFor(() => {
          expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
            params: expect.objectContaining({ search: "login" }),
          });
        });

        mockedAxios.get.mockRejectedValue(new Error("Network Error"));

        await user.click(screen.getByRole("button", CLEAR));

        await waitFor(() => {
          expect(
            screen.getByText("Failed to fetch tickets")
          ).toBeInTheDocument();
        });

        // Filter state does not roll back to the pre-clear values.
        expect(searchBox()).toHaveValue("");
        expect(screen.queryByRole("button", CLEAR)).not.toBeInTheDocument();
      });

      it("CASE-739c6fe5dd97: clearing during an in-flight filtered request settles on the unfiltered set", async () => {
        const user = userEvent.setup();
        let resolveFiltered: (value: unknown) => void = () => {};
        const filtered = new Promise((resolve) => {
          resolveFiltered = resolve;
        });

        // Routes by param rather than by call order, so the number of requests
        // the page happens to make cannot desynchronise the fixture.
        mockedAxios.get.mockImplementation(async (_url, config) => {
          const params = config?.params as { search?: string } | undefined;
          return params?.search ? filtered : mockResponse();
        });

        renderWithQuery(<TicketsPage />);
        await waitFor(() => {
          expect(
            screen.getByText("Cannot login to my account")
          ).toBeInTheDocument();
        });

        // Single character, so exactly one filtered request is in flight.
        await user.type(searchBox(), "l");
        await user.click(screen.getByRole("button", CLEAR));

        await waitFor(() => {
          expect(
            screen.getByText("Refund for order #123")
          ).toBeInTheDocument();
        });

        // The stale filtered response lands only now. It carries a single row, so
        // the table would visibly lose two rows if it rendered. Flush explicitly
        // before asserting: a waitFor here would resolve on a condition that is
        // already true and would prove nothing about the stale response.
        resolveFiltered(mockResponse([mockTickets[0]]));
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(screen.getByText("Refund for order #123")).toBeInTheDocument();
        expect(
          screen.getByText("How do I reset my password?")
        ).toBeInTheDocument();
        const lastParams = mockedAxios.get.mock.calls.at(-1)?.[1]?.params;
        expect(lastParams).not.toHaveProperty("search");
      });
    });

    describe("AC5 — preserve sorting", () => {
      it("CASE-4c12ec6a7a66: preserves a Subject ascending sort in the request", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.click(screen.getByRole("button", { name: /Subject/ }));
        await user.type(searchBox(), "login");

        await waitFor(() => {
          expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
            params: expect.objectContaining({
              sortBy: "subject",
              sortOrder: "asc",
              search: "login",
            }),
          });
        });

        mockedAxios.get.mockClear();
        mockedAxios.get.mockResolvedValue(mockResponse());

        await user.click(screen.getByRole("button", CLEAR));

        await waitFor(() => {
          expect(mockedAxios.get).toHaveBeenLastCalledWith("/api/tickets", {
            params: {
              sortBy: "subject",
              sortOrder: "asc",
              page: 1,
              pageSize: 10,
            },
          });
        });
      });

      // The request assertion alone would miss an implementation that remounts
      // TicketsTable and re-issues the default sort.
      it("CASE-a0b14a332363: the Subject header still shows the ascending arrow after clearing", async () => {
        const user = userEvent.setup();
        await renderLoaded();

        await user.click(screen.getByRole("button", { name: /Subject/ }));
        await user.type(searchBox(), "login");
        await user.click(screen.getByRole("button", CLEAR));

        const subjectHeader = screen.getByRole("button", { name: /Subject/ });
        expect(
          subjectHeader.querySelector(".lucide-arrow-up")
        ).toBeInTheDocument();
        expect(
          subjectHeader.querySelector(".lucide-arrow-up-down")
        ).not.toBeInTheDocument();
      });
    });

    describe("AC6 — reset pagination", () => {
      // The filter is applied BEFORE paginating: filtering resets to page 1, so
      // the reverse order would never leave page 1 and never exercise AC6.
      async function reachPageThreeWithFilter(user: User) {
        await renderLoaded(50);

        await user.type(searchBox(), "login");
        await waitFor(() => {
          expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
            params: expect.objectContaining({ search: "login", page: 1 }),
          });
        });

        await user.click(screen.getByRole("button", { name: "Next page" }));
        await waitFor(() => {
          expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
            params: expect.objectContaining({ search: "login", page: 2 }),
          });
        });

        await user.click(screen.getByRole("button", { name: "Next page" }));
        await waitFor(() => {
          expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
            params: expect.objectContaining({ search: "login", page: 3 }),
          });
        });
      }

      // Asserts the LAST call: the pageIndex reset lives in the filters-keyed
      // effect at TicketsTable.tsx:107-109, so one page-3 unfiltered request may
      // legitimately fire before settling. AC6's second sentence allows that.
      it("CASE-0f03d7775fad: clearing from page 3 settles the query on page 1", async () => {
        const user = userEvent.setup();
        await reachPageThreeWithFilter(user);

        mockedAxios.get.mockClear();
        mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));

        await user.click(screen.getByRole("button", CLEAR));

        await waitFor(() => {
          expect(mockedAxios.get).toHaveBeenLastCalledWith("/api/tickets", {
            params: {
              sortBy: "createdAt",
              sortOrder: "desc",
              page: 1,
              pageSize: 10,
            },
          });
        });
      });

      it("CASE-b809d54aaa12: the page indicator reads Page 1 after clearing from page 3", async () => {
        const user = userEvent.setup();
        await reachPageThreeWithFilter(user);

        await user.click(screen.getByRole("button", CLEAR));

        await waitFor(() => {
          expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
        });
        expect(
          screen.getByText("Showing 1–10 of 50 tickets")
        ).toBeInTheDocument();
      });
    });
  });
});
