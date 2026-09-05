import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import "@/test/pointer-events";
import { renderWithQuery } from "@/test/render";
import TicketsPage from "./TicketsPage";


vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

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

/** The filter controls are Radix Selects: buttons with role combobox, in render order. */
const statusFilterTrigger = () => screen.getAllByRole("combobox")[0];

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

  // CASE-980cc3885141 — the AC9 control. This assertion is an exact match on a closed params
  // object and must stay one: loosening it to objectContaining is how a new param slips into the
  // request unnoticed.
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

  // CASE-47298dac3ca4 — the { tickets, total, page, pageSize } response is still consumed the same
  // way: rows, total count and footer text all read as they did before the change
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

    // CASE-e08e0e3c793c, and the counterpart to the rule above: a discrete choice is a real
    // navigation, so Back undoes it.
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

    // Regression guard for the trim bug: the search input is controlled by the URL, so trimming on
    // read discarded every typed space before the next character arrived.
    it("should let a multi-word search term be typed", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt();

      const input = screen.getByPlaceholderText("Search tickets...");
      await user.type(input, "vpn access");

      await waitFor(() => expect(input).toHaveValue("vpn access"));
      expect(currentSearch()).toBe("?search=vpn+access");
      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ search: "vpn access" })
      );
    });

    // CASE-5e855865f6b2
    it("should write the category to the URL when one is selected", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt();

      const [, categoryTrigger] = screen.getAllByRole("combobox");
      await user.click(categoryTrigger);
      await user.click(
        await screen.findByRole("option", { name: "Refund request" })
      );

      await waitFor(() =>
        expect(currentSearch()).toBe("?category=refund_request")
      );
      expect(lastRequestParams()).toMatchObject({
        category: "refund_request",
      });
    });

    // CASE-f3e86fed5d68
    it("should carry all three filters in the URL at once", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt();

      const [statusTrigger, categoryTrigger] = screen.getAllByRole("combobox");
      await user.click(statusTrigger);
      await user.click(await screen.findByRole("option", { name: "Closed" }));
      await waitFor(() => expect(currentSearch()).toBe("?status=closed"));

      await user.click(categoryTrigger);
      await user.click(
        await screen.findByRole("option", { name: "General question" })
      );
      await user.type(screen.getByPlaceholderText("Search tickets..."), "vpn");

      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({
          status: "closed",
          category: "general_question",
          search: "vpn",
        })
      );
      expect(currentSearch()).toBe(
        "?status=closed&category=general_question&search=vpn"
      );
    });

    // CASE-b545d0a5c4bf
    it("should keep both filters when a second is chosen before the first settles", async () => {
      const user = userEvent.setup();
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      mockedAxios.get.mockImplementation(
        async () => {
          await held;
          return mockResponse();
        }
      );
      renderTicketsAt();

      const [statusTrigger, categoryTrigger] = screen.getAllByRole("combobox");
      await user.click(statusTrigger);
      await user.click(await screen.findByRole("option", { name: "Open" }));
      await user.click(categoryTrigger);
      await user.click(
        await screen.findByRole("option", { name: "Refund request" })
      );

      release();

      await waitFor(() =>
        expect(currentSearch()).toBe("?status=open&category=refund_request")
      );
      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({
          status: "open",
          category: "refund_request",
        })
      );
      // The case expects the *settled list* to reflect both filters, so the rows have to be checked
      // once the held response resolves — a URL assertion alone would pass without the response.
      await waitFor(() =>
        expect(
          screen.getByText("Cannot login to my account")
        ).toBeInTheDocument()
      );
      expect(screen.getAllByRole("row").slice(1)).toHaveLength(
        mockTickets.length
      );
    });

    // CASE-2845362e6dfc — the filter has to survive the failure, or the reader cannot correct it
    it("should keep the filter in the URL when the request fails", async () => {
      mockedAxios.get.mockRejectedValue(new Error("Network Error"));
      renderTicketsAt("/tickets?status=open");

      await waitFor(() =>
        expect(screen.getByText("Failed to fetch tickets")).toBeInTheDocument()
      );
      expect(currentSearch()).toBe("?status=open");
    });

    // CASE-337c883e0c29, CASE-e8fb8a4bf179 — typed character by character, so the URL settling on
    // the whole term is also the assertion that a fast typist does not leave it on a prefix
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
      // CASE-12efbff9d879 also requires that no other header claims a direction
      for (const name of [/Sender/, /Status/, /Category/, /Created/]) {
        const header = screen.getByRole("button", { name });
        expect(header.querySelector(".lucide-arrow-up")).toBeNull();
        expect(header.querySelector(".lucide-arrow-down")).toBeNull();
      }
    });

    // CASE-1d6a0684e1d0
    it.each([
      ["asc", "lucide-arrow-up"],
      ["desc", "lucide-arrow-down"],
    ])("should show the %s arrow for that direction in the URL", async (
      order,
      icon
    ) => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt(`/tickets?sortBy=subject&sortOrder=${order}`);

      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ sortOrder: order })
      );
      const subjectHeader = screen.getByRole("button", { name: /Subject/ });
      expect(subjectHeader.querySelector(`.${icon}`)).toBeTruthy();
    });

    // TanStack clears the sort on a third click of the same header (enableSortingRemoval defaults
    // on), so the fallback in onSortingChange is a live path. Changing it to subject/asc left the
    // whole suite green before this test existed.
    it("should fall back to the default sort when a third click clears it", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt();

      await waitFor(() =>
        expect(screen.getByText("Cannot login to my account")).toBeInTheDocument()
      );

      const subject = screen.getByRole("button", { name: /Subject/ });
      await user.click(subject);
      await waitFor(() => expect(currentSearch()).toBe("?sortBy=subject&sortOrder=asc"));
      await user.click(subject);
      await waitFor(() => expect(currentSearch()).toBe("?sortBy=subject&sortOrder=desc"));

      await user.click(subject);

      // Back to createdAt/desc, which AC8 then omits from the URL entirely
      await waitFor(() => expect(currentSearch()).toBe(""));
      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({
          sortBy: "createdAt",
          sortOrder: "desc",
        })
      );
      expect(
        subject.querySelector(".lucide-arrow-up, .lucide-arrow-down")
      ).toBeNull();
    });

    // CASE-33e9012af743 — Subject then Created, as the case specifies.
    //
    // The case's expected result was amended to case-set revision 4. It said the URL would "reflect
    // sortBy=createdAt", which cannot happen: Created descending is the default pair, and AC8
    // requires defaults be omitted, so landing there empties the sort params instead. The behaviour
    // under test is unchanged — the second click wins — and the assertion now states it in terms
    // the two ACs can both hold.
    it("should settle on the second column when two headers are clicked in flight", async () => {
      const user = userEvent.setup();
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      mockedAxios.get.mockImplementation(async () => {
        await held;
        return mockResponse();
      });
      renderTicketsAt();

      await user.click(screen.getByRole("button", { name: /Subject/ }));
      await expect.poll(() => currentSearch()).toMatch(/sortBy=subject/);

      await user.click(screen.getByRole("button", { name: /Created/ }));

      release();

      // Created descending is the default pair, so the URL empties — the sort is no longer Subject.
      // The direction is not asserted beyond that: with no rows loaded TanStack cannot infer the
      // column type and starts a string column descending instead of ascending. Verified against
      // its getFirstSortDir; incidental here and covered by AC2's own direction cases.
      await waitFor(() => expect(currentSearch()).toBe(""));
      expect(currentSearch()).not.toMatch(/sortBy=subject/);

      // No fresh request is expected for the default sort: its query key is the one the first mount
      // already issued and is still awaiting, so React Query serves it rather than refetching. The
      // check is that a default-sort request exists and the settled rows came from it.
      const sorts = mockedAxios.get.mock.calls.map(
        (call) => (call[1]?.params as { sortBy?: string } | undefined)?.sortBy
      );
      expect(sorts).toContain("createdAt");

      await waitFor(() =>
        expect(
          screen.getByText("Cannot login to my account")
        ).toBeInTheDocument()
      );
      const subjects = screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.querySelector("a")?.textContent);
      expect(subjects).toEqual(mockTickets.map((ticket) => ticket.subject));
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

      // A real re-render, forced from inside the tree. Calling rerender() with the same element
      // object does nothing: React sees oldProps === newProps and skips the subtree, so the
      // assertions below would pass against any implementation at all. The token proves the
      // re-render actually happened — TicketsPage sits in these children with no memo boundary, so
      // it re-renders whenever this does.
      function Harness() {
        const [renders, force] = useState(0);
        return (
          <>
            <span data-testid="render-token">{renders}</span>
            <button onClick={() => force((n) => n + 1)}>force re-render</button>
            <Routes>
              <Route path="/tickets" element={<TicketsPage />} />
            </Routes>
            <LocationProbe />
          </>
        );
      }

      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/tickets?status=open&page=2"]}>
          <QueryClientProvider
            client={
              new QueryClient({ defaultOptions: { queries: { retry: false } } })
            }
          >
            <Harness />
          </QueryClientProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
      });
      expect(lastRequestParams()).toMatchObject({ page: 2, status: "open" });
      expect(screen.getByTestId("render-token")).toHaveTextContent("0");

      mockedAxios.get.mockClear();
      await user.click(screen.getByRole("button", { name: "force re-render" }));

      // The token moved, so the subtree really did re-render
      await waitFor(() =>
        expect(screen.getByTestId("render-token")).toHaveTextContent("1")
      );
      expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
      expect(currentSearch()).toBe("?status=open&page=2");
      // A page reset would show up as a page-1 request. The old effect-based implementation would
      // have fired one here, because `filters` is a fresh object on every render.
      const pages = mockedAxios.get.mock.calls
        .map((call) => (call[1]?.params as { page?: number } | undefined)?.page)
        .filter((page) => page !== undefined);
      expect(pages).not.toContain(1);
    });

    // CASE-752a41e3d870
    it("should disable the forward controls on the last page from the URL", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderTicketsAt("/tickets?page=5");

      await waitFor(() =>
        expect(screen.getByText("Page 5 of 5")).toBeInTheDocument()
      );
      expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Last page" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "First page" })).toBeEnabled();
    });

    // CASE-33183e39dc55
    it("should request the same page on a refetch", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <MemoryRouter initialEntries={["/tickets?page=2"]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route path="/tickets" element={<TicketsPage />} />
            </Routes>
            <LocationProbe />
          </QueryClientProvider>
        </MemoryRouter>
      );

      await waitFor(() =>
        expect(screen.getByText("Page 2 of 5")).toBeInTheDocument()
      );

      mockedAxios.get.mockClear();
      await queryClient.refetchQueries({ queryKey: ["tickets"] });

      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
      expect(lastRequestParams()).toMatchObject({ page: 2 });
      expect(currentSearch()).toBe("?page=2");
    });

    // CASE-9be39e305430
    it("should keep the page in the URL when the request fails", async () => {
      mockedAxios.get.mockRejectedValue(new Error("Network Error"));
      renderTicketsAt("/tickets?page=2");

      await waitFor(() =>
        expect(screen.getByText("Failed to fetch tickets")).toBeInTheDocument()
      );
      expect(currentSearch()).toBe("?page=2");
    });

    // CASE-c27e798cbe1d — the page is URL-controllable now, so it can name a page past the end.
    // The footer used to read "Showing 981–50 of 50 tickets".
    it("should not show a nonsensical range for a page past the end", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse([], 50));
      renderTicketsAt("/tickets?page=999999");

      await waitFor(() =>
        expect(
          screen.getByText(
            "Page 999999 does not exist — 50 tickets across 5 pages"
          )
        ).toBeInTheDocument()
      );
      expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Page 999999 of/)).not.toBeInTheDocument();
      expect(screen.queryByText("Failed to fetch tickets")).not.toBeInTheDocument();

      // Next and Last are disabled this far past the end, so without an escape the only way back is
      // Previous once per page or editing the URL by hand.
      await user.click(screen.getByRole("button", { name: "Go to last page" }));

      await waitFor(() => expect(currentSearch()).toBe("?page=5"));
    });

    it("should pluralise the out-of-range message for a single ticket and page", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse([], 1));
      renderTicketsAt("/tickets?page=4");

      await waitFor(() =>
        expect(
          screen.getByText("Page 4 does not exist — 1 ticket across 1 page")
        ).toBeInTheDocument()
      );
    });

    // A filter matching nothing gives total 0, so pageCount is 0 and every page above the first is
    // out of range. Written against pageCount rather than `total > 0` for exactly this case, which
    // otherwise still read "Page 99 of 1".
    it("should treat a page above the first as out of range when nothing matches", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse([], 0));
      renderTicketsAt("/tickets?status=closed&page=99");

      await waitFor(() =>
        expect(
          screen.getByText("Page 99 does not exist — 0 tickets across 1 page")
        ).toBeInTheDocument()
      );
      expect(screen.queryByText(/^Page 99 of/)).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Go to last page" }));

      await waitFor(() => expect(currentSearch()).toBe("?status=closed"));
    });

    it("should still say No tickets on the first page when nothing matches", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse([], 0));
      renderTicketsAt("/tickets?status=closed");

      await waitFor(() =>
        expect(screen.getByText("No tickets")).toBeInTheDocument()
      );
      expect(
        screen.queryByRole("button", { name: "Go to last page" })
      ).not.toBeInTheDocument();
    });

    // CASE-93514dfd0070 (double-click) — TanStack advances one page per click
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

  // AC5's cases are E2E in the plan because real Back/Forward needs a real browser. That is true of
  // window.history, but not of a router POP: MemoryRouter can be navigated backwards, and doing so
  // exercises the whole path that matters here — the list re-deriving itself from the popped URL.
  // These are the executable half of AC5, and they stand whether or not the E2E specs ever run.
  describe("AC5 — a history POP re-derives the list from the popped URL", () => {
    function renderWithBackButton(entries: string[]) {
      function BackButton() {
        const navigate = useNavigate();
        return (
          <button onClick={() => navigate(-1)}>go back</button>
        );
      }
      return render(
        <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
          <QueryClientProvider
            client={
              new QueryClient({ defaultOptions: { queries: { retry: false } } })
            }
          >
            <BackButton />
            <Routes>
              <Route path="/tickets" element={<TicketsPage />} />
            </Routes>
            <LocationProbe />
          </QueryClientProvider>
        </MemoryRouter>
      );
    }

    // CASE-f8fac94b30ab
    it("should undo a filter change on a POP", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderWithBackButton(["/tickets", "/tickets?status=open"]);

      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ status: "open" })
      );
      expect(statusFilterTrigger()).toHaveTextContent("Open");

      await user.click(screen.getByRole("button", { name: "go back" }));

      await waitFor(() => expect(currentSearch()).toBe(""));
      expect(lastNavigation()).toBe("POP");
      // the controls and the request follow the popped URL, not the state they were left in
      expect(statusFilterTrigger()).toHaveTextContent("All statuses");
      await waitFor(() =>
        expect(lastRequestParams()).not.toHaveProperty("status")
      );
    });

    // CASE-8548791d29f3
    it("should undo a page change on a POP", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderWithBackButton(["/tickets", "/tickets?page=2"]);

      await waitFor(() =>
        expect(screen.getByText("Page 2 of 5")).toBeInTheDocument()
      );

      await user.click(screen.getByRole("button", { name: "go back" }));

      await waitFor(() =>
        expect(screen.getByText("Page 1 of 5")).toBeInTheDocument()
      );
      expect(currentSearch()).toBe("");
      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ page: 1 })
      );
    });

    // CASE-a95f558f6ba0 — three states unwind in order
    it("should unwind three states in order on successive POPs", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderWithBackButton([
        "/tickets",
        "/tickets?status=open",
        "/tickets?status=open&sortBy=subject&sortOrder=asc",
        "/tickets?status=open&sortBy=subject&sortOrder=asc&page=2",
      ]);

      await waitFor(() =>
        expect(screen.getByText("Page 2 of 5")).toBeInTheDocument()
      );

      const back = screen.getByRole("button", { name: "go back" });

      await user.click(back);
      await waitFor(() =>
        expect(currentSearch()).toBe(
          "?status=open&sortBy=subject&sortOrder=asc"
        )
      );

      await user.click(back);
      await waitFor(() => expect(currentSearch()).toBe("?status=open"));
      expect(statusFilterTrigger()).toHaveTextContent("Open");

      await user.click(back);
      await waitFor(() => expect(currentSearch()).toBe(""));
      expect(statusFilterTrigger()).toHaveTextContent("All statuses");
    });
  });

  describe("AC4 — handing the list state to the ticket detail page", () => {
    // CASE-20e7b0b98b08 producer half. The consumer half is covered in TicketDetailPage.test.tsx,
    // but nothing asserted the list actually attaches the state — the `state` prop could be deleted
    // from the subject Link and every other test still passed. The destination here is a probe
    // rather than the real detail page, so the assertion is about the hand-off and nothing else.
    it("should attach its query string to the ticket link's router state", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));

      function StateProbe() {
        const { state } = useLocation();
        return (
          <div data-testid="handed-state">
            {(state as { listSearch?: string } | null)?.listSearch ??
              "NO STATE"}
          </div>
        );
      }

      const listUrl = "/tickets?status=open&sortBy=subject&sortOrder=asc&page=2";
      render(
        <MemoryRouter initialEntries={[listUrl]}>
          <QueryClientProvider
            client={
              new QueryClient({ defaultOptions: { queries: { retry: false } } })
            }
          >
            <Routes>
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/:id" element={<StateProbe />} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      );

      await waitFor(() =>
        expect(
          screen.getByRole("link", { name: "Cannot login to my account" })
        ).toBeInTheDocument()
      );

      await user.click(
        screen.getByRole("link", { name: "Cannot login to my account" })
      );

      const handed = await screen.findByTestId("handed-state");
      expect(handed).toHaveTextContent(
        "?status=open&sortBy=subject&sortOrder=asc&page=2"
      );
    });
  });

  describe("AC4 — state comes from the URL alone", () => {
    // CASE-8d69642c9b08 — nothing is held outside the URL, so a remount reproduces the view
    it("should reproduce the same view on a remount at the same URL", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      const url = "/tickets?status=open&sortBy=subject&sortOrder=asc&page=2";

      const first = renderTicketsAt(url);
      await waitFor(() =>
        expect(screen.getByText("Page 2 of 5")).toBeInTheDocument()
      );
      const firstParams = lastRequestParams();
      first.unmount();

      mockedAxios.get.mockClear();
      renderTicketsAt(url);
      await waitFor(() =>
        expect(screen.getByText("Page 2 of 5")).toBeInTheDocument()
      );

      expect(lastRequestParams()).toEqual(firstParams);
      expect(statusFilterTrigger()).toHaveTextContent("Open");
      expect(currentSearch()).toBe(
        "?status=open&sortBy=subject&sortOrder=asc&page=2"
      );
    });
  });

  describe("AC6 — a filter or sort change resets to page 1", () => {
    // CASE-54ddb84f8d5c
    it("should reset to page 1 when the status changes", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderTicketsAt("/tickets?page=3");

      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ page: 3 })
      );

      await user.click(statusFilterTrigger());
      await user.click(await screen.findByRole("option", { name: "Open" }));

      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ page: 1, status: "open" })
      );
      expect(currentSearch()).toBe("?status=open");
    });

    // CASE-1f30bb0a8eee
    it("should reset to page 1 when the category changes", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderTicketsAt("/tickets?page=3");

      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ page: 3 })
      );

      const [, categoryTrigger] = screen.getAllByRole("combobox");
      await user.click(categoryTrigger);
      await user.click(
        await screen.findByRole("option", { name: "Refund request" })
      );

      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({
          page: 1,
          category: "refund_request",
        })
      );
      expect(currentSearch()).toBe("?category=refund_request");
    });

    // CASE-b7a0968876d3
    it("should reset to page 1 and drop both params when a filter is cleared", async () => {
      const user = userEvent.setup();
      mockedAxios.get.mockResolvedValue(mockResponse(mockTickets, 50));
      renderTicketsAt("/tickets?status=open&page=3");

      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ page: 3, status: "open" })
      );

      await user.click(statusFilterTrigger());
      await user.click(
        await screen.findByRole("option", { name: "All statuses" })
      );

      await waitFor(() => expect(currentSearch()).toBe(""));
      expect(lastRequestParams()).toMatchObject({ page: 1 });
      expect(lastRequestParams()).not.toHaveProperty("status");
      // Clearing a filter is a discrete choice, so it pushes and Back undoes it
      expect(lastNavigation()).toBe("PUSH");
    });

    // CASE-1e9fb05ae79a
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
      // Clearing ends the search rather than refining it, so it pushes. Replacing here would
      // overwrite the search entry with the URL of the entry before it, and the reader's first Back
      // would appear to do nothing.
      expect(lastNavigation()).toBe("PUSH");
    });

    // A whitespace-only term stays in the URL and the input, because trimming on the way in is what
    // stopped a space being typed at all — but it is not a filter anyone meant, so it is not sent.
    it("should not send a whitespace-only search term to the API", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt("/tickets?search=%20%20");

      await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
      expect(lastRequestParams()).not.toHaveProperty("search");
      // Still in the URL and still in the input — only the request drops it
      expect(screen.getByPlaceholderText("Search tickets...")).toHaveValue("  ");
      expect(new URLSearchParams(currentSearch()!).get("search")).toBe("  ");
    });

    it("should send a search term without its surrounding whitespace", async () => {
      mockedAxios.get.mockResolvedValue(mockResponse());
      renderTicketsAt("/tickets?search=+vpn+");

      await waitFor(() =>
        expect(lastRequestParams()).toMatchObject({ search: "vpn" })
      );
      // the reader still sees exactly what they typed
      expect(screen.getByPlaceholderText("Search tickets...")).toHaveValue(
        " vpn "
      );
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
