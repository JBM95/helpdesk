import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { renderWithQuery } from "@/test/render";
import TicketsPage from "./TicketsPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

// Radix Select relies on pointer capture APIs not available in jsdom (same shim as
// TicketDetailPage.test.tsx, which drives the status and category selects there)
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

/**
 * Reads the live query string back out of the router so a test can assert what the URL says, not
 * just what was requested.
 */
function LocationProbe() {
  const { search } = useLocation();
  // PUSH or REPLACE for the navigation that produced the current entry. MemoryRouter keeps its own
  // stack rather than window.history, so this is the only honest way to tell the two apart.
  const navigationType = useNavigationType();
  return (
    <>
      <div data-testid="location-search">{search}</div>
      <div data-testid="navigation-type">{navigationType}</div>
    </>
  );
}

const currentSearch = () => screen.getByTestId("location-search").textContent;
const lastNavigation = () =>
  screen.getByTestId("navigation-type").textContent;

/**
 * Mounts the tickets list at a given URL.
 *
 * `renderWithQuery` is deliberately not used here and deliberately not extended: it is shared by
 * seven test files, and giving it an `initialEntries` parameter for this one story would put every
 * component test in this story's blast radius.
 */
function renderTicketsAt(url = "/tickets") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/tickets" element={<TicketsPage />} />
        </Routes>
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const lastRequestParams = () =>
  mockedAxios.get.mock.calls.at(-1)?.[1]?.params as
    | Record<string, unknown>
    | undefined;

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
    renderTicketsAt("/tickets?status=open");

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({ status: "open" }),
      });
    });
  });

  it("should include category filter in API request", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse([mockTickets[1]]));
    renderTicketsAt("/tickets?category=refund_request");

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/tickets", {
        params: expect.objectContaining({ category: "refund_request" }),
      });
    });
  });

  it("should include search filter in API request", async () => {
    mockedAxios.get.mockResolvedValue(mockResponse([mockTickets[0]]));
    renderTicketsAt("/tickets?search=login");

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
});

describe("TicketsPage — list state in the URL", () => {
  describe("AC1 — filters", () => {
    // CASE-3924bab2bec2
    it("should initialise all three filter controls from the URL", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt(
        "/tickets?status=open&category=technical_question&search=login"
      );

      expect(screen.getByPlaceholderText("Search tickets...")).toHaveValue(
        "login"
      );
      // The two Select triggers, in render order. Asserted by role rather than by text because
      // "Open" also appears as a status badge in the table once the rows load.
      const [statusTrigger, categoryTrigger] = screen.getAllByRole("combobox");
      expect(statusTrigger).toHaveTextContent("Open");
      expect(categoryTrigger).toHaveTextContent("Technical question");
    });

    // CASE-27dd90575a06
    it("should send the URL filters on the first request", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt(
        "/tickets?status=resolved&category=general_question&search=vpn"
      );

      await waitFor(() => {
        expect(lastRequestParams()).toMatchObject({
          status: "resolved",
          category: "general_question",
          search: "vpn",
        });
      });
    });

    // CASE-222fa42cb560 — typing must not leave one history entry per character, or Back walks the
    // reader back through "logi", "log", "lo" instead of leaving the list.
    it("should replace rather than push history while the search term is typed", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt();

      await waitFor(() => expect(currentSearch()).toBe(""));

      await user.type(screen.getByPlaceholderText("Search tickets..."), "login");
      await waitFor(() => expect(currentSearch()).toBe("?search=login"));

      expect(lastNavigation()).toBe("REPLACE");
    });

    // The other half of that rule: the first keystroke pushes, so a search session gets exactly one
    // history entry and one Back returns to the list as it was before the search.
    it("should push history on the first keystroke of a new search", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt();

      await waitFor(() => expect(currentSearch()).toBe(""));

      await user.type(screen.getByPlaceholderText("Search tickets..."), "l");

      await waitFor(() => expect(currentSearch()).toBe("?search=l"));
      expect(lastNavigation()).toBe("PUSH");
    });

    // The counterpart: a discrete choice is a real navigation, so Back undoes it.
    it("should push history when a status is selected", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt();

      await waitFor(() => expect(currentSearch()).toBe(""));

      const [statusTrigger] = screen.getAllByRole("combobox");
      await user.click(statusTrigger);
      await user.click(await screen.findByRole("option", { name: "Resolved" }));

      await waitFor(() => expect(currentSearch()).toBe("?status=resolved"));
      expect(lastNavigation()).toBe("PUSH");
    });

    // CASE-337c883e0c29
    it("should write the search term to the URL as it is typed", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt();

      await waitFor(() => expect(currentSearch()).toBe(""));

      await user.type(screen.getByPlaceholderText("Search tickets..."), "login");

      await waitFor(() => {
        expect(currentSearch()).toBe("?search=login");
      });
    });
  });

  describe("AC2 — sorting", () => {
    // CASE-12efbff9d879
    it("should show the sort indicator matching the URL", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt("/tickets?sortBy=subject&sortOrder=asc");

      await waitFor(() => {
        expect(lastRequestParams()).toMatchObject({
          sortBy: "subject",
          sortOrder: "asc",
        });
      });
      // lucide renders the icon as an svg inside the header button
      const subjectHeader = screen.getByRole("button", { name: /Subject/ });
      expect(subjectHeader.querySelector(".lucide-arrow-up")).toBeTruthy();
    });

    // CASE-fabda9180a68
    it("should write sortBy and sortOrder to the URL on a header click", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt();

      await waitFor(() =>
        expect(screen.getByText("Cannot login to my account")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Subject/ }));

      await waitFor(() => {
        expect(currentSearch()).toBe("?sortBy=subject&sortOrder=asc");
      });
    });

    // CASE-4234ebc72492
    it("should flip sortOrder in the URL on a second click", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt("/tickets?sortBy=subject&sortOrder=asc");

      await waitFor(() =>
        expect(screen.getByText("Cannot login to my account")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Subject/ }));

      await waitFor(() => {
        expect(currentSearch()).toBe("?sortBy=subject&sortOrder=desc");
      });
    });
  });

  describe("AC3 — pagination", () => {
    // CASE-adc92fc24569
    it("should request the page named in the URL", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderTicketsAt("/tickets?page=2");

      // The footer only renders once the response has settled, so wait on that rather than on the
      // request being made — the request fires first and the footer is the observable outcome.
      await waitFor(() => {
        expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
      });
      expect(lastRequestParams()).toMatchObject({ page: 2, pageSize: 10 });
      expect(screen.getByText("Showing 11–20 of 50 tickets")).toBeInTheDocument();
    });

    // CASE-e83eec605a96
    it("should write the page to the URL when advancing", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderTicketsAt();

      await waitFor(() =>
        expect(screen.getByText("Showing 1–10 of 50 tickets")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: "Next page" }));

      await waitFor(() => expect(currentSearch()).toBe("?page=2"));
    });

    // CASE-875adb87792b
    it("should track the page through Last, Previous and First", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderTicketsAt();

      await waitFor(() =>
        expect(screen.getByText("Showing 1–10 of 50 tickets")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: "Last page" }));
      await waitFor(() => expect(currentSearch()).toBe("?page=5"));

      await user.click(screen.getByRole("button", { name: "Previous page" }));
      await waitFor(() => expect(currentSearch()).toBe("?page=4"));

      await user.click(screen.getByRole("button", { name: "First page" }));
      await waitFor(() => expect(currentSearch()).toBe(""));
    });

    // CASE-9a9129bfb43d — the regression this story is most likely to introduce. The old
    // implementation reset pageIndex in an effect keyed on the `filters` object, so once filters
    // are derived from search params a fresh object per render would reset the page every render.
    it("should keep the page across a re-render with unchanged filters", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      // The same element and the same client on both renders, so this is a genuine re-render rather
      // than a remount with a cold cache.
      const tree = (
        <MemoryRouter initialEntries={["/tickets?status=open&page=2"]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route path="/tickets" element={<TicketsPage />} />
            </Routes>
            <LocationProbe />
          </QueryClientProvider>
        </MemoryRouter>
      );
      const { rerender } = render(tree);

      await waitFor(() => {
        expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
      });
      expect(lastRequestParams()).toMatchObject({ page: 2, status: "open" });

      mockedAxios.get.mockClear();
      rerender(tree);

      expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
      expect(currentSearch()).toBe("?status=open&page=2");
      // A page reset would show up as a page-1 request; the old effect-based implementation would
      // have fired one here, because `filters` is a fresh object on every render.
      const pages = mockedAxios.get.mock.calls
        .map((call) => (call[1]?.params as { page?: number } | undefined)?.page)
        .filter((page) => page !== undefined);
      expect(pages).not.toContain(1);
    });

    // CASE-093514dfd0070 (double-click) — TanStack advances one page per click
    it("should advance exactly one page on a double-click of Next", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderTicketsAt();

      await waitFor(() =>
        expect(screen.getByText("Showing 1–10 of 50 tickets")).toBeInTheDocument()
      );

      await user.dblClick(screen.getByRole("button", { name: "Next page" }));

      await waitFor(() => expect(currentSearch()).toBe("?page=2"));
    });

    // CASE-095552a8995f
    it("should render without crashing for a page beyond the last", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse([], 50));
      renderTicketsAt("/tickets?page=99");

      await waitFor(() => {
        expect(screen.getByRole("table")).toBeInTheDocument();
      });
      expect(screen.queryByText("Failed to fetch tickets")).not.toBeInTheDocument();
    });
  });

  describe("AC6 — a filter or sort change resets to page 1", () => {
    // CASE-54ddb84f8d5c
    it("should reset to page 1 when the search term changes", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderTicketsAt("/tickets?page=3");

      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ page: 3 })
      );

      await user.type(screen.getByPlaceholderText("Search tickets..."), "vpn");

      await waitFor(() => {
        expect(lastRequestParams()).toMatchObject({ page: 1, search: "vpn" });
      });
      // CASE-187f6a80d1e3 — the reset is visible in the URL, not only in the request
      expect(currentSearch()).toBe("?search=vpn");
    });

    // CASE-0947995d87db
    it("should reset to page 1 when the sort changes", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderTicketsAt("/tickets?page=3");

      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ page: 3 })
      );

      await user.click(screen.getByRole("button", { name: /Subject/ }));

      await waitFor(() => {
        expect(lastRequestParams()).toMatchObject({
          sortBy: "subject",
          sortOrder: "asc",
          page: 1,
        });
      });
      expect(currentSearch()).toBe("?sortBy=subject&sortOrder=asc");
    });
  });

  describe("AC7 — invalid params do not break the page", () => {
    // CASE-4cf6ae359e0d — the whole point: nothing the server would 400 on is ever sent
    it("should send only schema-valid params for an entirely invalid query string", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt(
        "/tickets?status=frozen&category=billing&sortBy=senderEmail&sortOrder=sideways&page=abc"
      );

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
      expect(screen.queryByText("Failed to fetch tickets")).not.toBeInTheDocument();
    });

    // CASE-4380d2a19b98
    it("should not forward status=new, which the API rejects", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt("/tickets?status=new");

      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
      expect(lastRequestParams()).not.toHaveProperty("status");
      expect(screen.getByText("All statuses")).toBeInTheDocument();
    });

    // CASE-167bc56de8f8
    it("should ignore an unknown param and honour the valid one beside it", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt("/tickets?assignee=me&status=open");

      await waitFor(() => {
        expect(lastRequestParams()).toMatchObject({ status: "open" });
      });
      expect(lastRequestParams()).not.toHaveProperty("assignee");
    });

    // CASE-7f01d782c90b
    it("should render the default list for a malformed query string", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt("/tickets?%%%&=&status");

      await waitFor(() => {
        expect(screen.getByText("Cannot login to my account")).toBeInTheDocument();
      });
      expect(screen.queryByText("Failed to fetch tickets")).not.toBeInTheDocument();
    });
  });

  describe("AC8 — clean URLs", () => {
    // CASE-c676aa4d6c2f
    it("should leave the URL empty for the default list", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt();

      await waitFor(() =>
        expect(screen.getByText("Cannot login to my account")).toBeInTheDocument()
      );
      expect(currentSearch()).toBe("");
    });

    // CASE-70b9f471d1ea
    it("should drop the search param when the input is cleared", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt("/tickets?search=login");

      const input = screen.getByPlaceholderText("Search tickets...");
      await waitFor(() => expect(input).toHaveValue("login"));

      await user.clear(input);

      await waitFor(() => expect(currentSearch()).toBe(""));
    });

    // CASE-76b3900894f2 — sorting back to the default pair empties the URL again
    it("should drop the sort params once the sort returns to the default", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt("/tickets?sortBy=createdAt&sortOrder=asc");

      await waitFor(() =>
        expect(screen.getByText("Cannot login to my account")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: /Created/ }));

      await waitFor(() => expect(currentSearch()).toBe(""));
    });
  });

  describe("AC9 — the API contract does not change", () => {
    // CASE-08476f34d947 — page size is not URL-controllable
    it("should ignore pageSize in the URL", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt("/tickets?pageSize=100");

      await waitFor(() => {
        expect(lastRequestParams()).toMatchObject({ pageSize: 10 });
      });
    });

    // CASE-a6d60258881b — no key outside ticketListQuerySchema is ever sent
    it("should only ever send keys the ticket list query schema accepts", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderTicketsAt("/tickets?status=open&category=refund_request&search=x");

      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
      await user.click(screen.getByRole("button", { name: /Subject/ }));
      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ sortBy: "subject" })
      );
      await user.click(screen.getByRole("button", { name: "Next page" }));
      await waitFor(() => expect(lastRequestParams()).toMatchObject({ page: 2 }));

      const allowed = new Set([
        "sortBy",
        "sortOrder",
        "status",
        "category",
        "search",
        "page",
        "pageSize",
      ]);
      for (const call of mockedAxios.get.mock.calls) {
        const params = call[1]?.params as Record<string, unknown>;
        expect(Object.keys(params).filter((key) => !allowed.has(key))).toEqual([]);
      }
    });
  });
});
