import { describe, it, expect } from "vitest";
import {
  DEFAULT_PAGE,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  parseTicketListParams,
  serializeTicketListParams,
  type TicketListParams,
} from "./ticket-list-params";

const parse = (search: string) =>
  parseTicketListParams(new URLSearchParams(search));

const defaults: TicketListParams = {
  status: undefined,
  category: undefined,
  search: undefined,
  sortBy: DEFAULT_SORT_BY,
  sortOrder: DEFAULT_SORT_ORDER,
  page: DEFAULT_PAGE,
};

describe("parseTicketListParams", () => {
  it("should return defaults for an empty query string", () => {
    expect(parse("")).toEqual(defaults);
  });

  // AC1 — CASE-3924bab2bec2, CASE-27dd90575a06
  it("should read status, category and search from the query string", () => {
    expect(parse("?status=open&category=technical_question&search=login")).toEqual({
      ...defaults,
      status: "open",
      category: "technical_question",
      search: "login",
    });
  });

  // AC2 — CASE-d901f3d998b8
  it("should read sortBy and sortOrder from the query string", () => {
    expect(parse("?sortBy=senderName&sortOrder=asc")).toEqual({
      ...defaults,
      sortBy: "senderName",
      sortOrder: "asc",
    });
  });

  // AC2 — CASE-32e17db60aa6: every column the server accepts is accepted here
  it.each(["subject", "senderName", "status", "category", "createdAt"] as const)(
    "should accept %s as a sort column",
    (column) => {
      expect(parse(`?sortBy=${column}`).sortBy).toBe(column);
    }
  );

  // AC3 — CASE-adc92fc24569
  it("should read the page from the query string", () => {
    expect(parse("?page=4").page).toBe(4);
  });

  // AC1 — CASE-040ad9228689
  it("should accept a single-character search term", () => {
    expect(parse("?search=a").search).toBe("a");
  });

  // AC1 — CASE-655998d07a02
  it("should decode a search term containing URL-reserved characters", () => {
    const term = "a&b=c?d#e";
    const round = parse(`?${new URLSearchParams({ search: term })}`);
    expect(round.search).toBe(term);
  });

  // AC1 — CASE-2ae124573efe
  it("should not truncate a very long search term", () => {
    const term = "x".repeat(300);
    expect(parse(`?search=${term}`).search).toBe(term);
  });

  it("should treat a whitespace-only search term as absent", () => {
    expect(parse("?search=%20%20").search).toBeUndefined();
  });

  describe("AC7 — unsupported values fall back to defaults", () => {
    // CASE-94d5af5f9efe
    it("should drop an unsupported status", () => {
      expect(parse("?status=frozen").status).toBeUndefined();
    });

    // CASE-4380d2a19b98 — `new` is a real TicketStatus but not one an agent may filter by, so
    // the server rejects it with a 400. It has to be dropped here, not forwarded.
    it("should drop status=new even though it is a real ticket status", () => {
      expect(parse("?status=new").status).toBeUndefined();
    });

    // CASE-8646466a3043
    it("should drop an unsupported category", () => {
      expect(parse("?category=billing").category).toBeUndefined();
    });

    // CASE-0abb1d5dcdef — senderEmail is rendered in the sender column but is not sortable
    it("should fall back to the default sort for a rendered but unsortable column", () => {
      expect(parse("?sortBy=senderEmail").sortBy).toBe(DEFAULT_SORT_BY);
    });

    // CASE-5f5a79a6d058
    it("should fall back to the default direction for an unsupported sortOrder", () => {
      const params = parse("?sortBy=subject&sortOrder=sideways");
      expect(params.sortOrder).toBe(DEFAULT_SORT_ORDER);
      expect(params.sortBy).toBe("subject");
    });

    // CASE-b048b7aec830, CASE-f712934f69ca, CASE-73f3dcc5a1d6, CASE-8bca3b4a2a3a
    it.each(["0", "-1", "abc", "1.5", "", "Infinity", "NaN", "1,000"])(
      "should fall back to page 1 for page=%s",
      (value) => {
        expect(parse(`?page=${value}`).page).toBe(DEFAULT_PAGE);
      }
    );

    // Exponent notation is a valid integer and the server coerces it the same way
    // (z.coerce.number().int().min(1)), so it is passed through rather than rejected. Whether that
    // page exists is CASE-c27e798cbe1d's business, not this function's.
    it("should accept exponent notation as the integer it denotes", () => {
      expect(parse("?page=1e3").page).toBe(1000);
    });

    // CASE-34f10743279c — URLSearchParams.get returns the first value
    it("should resolve duplicate status keys to a single supported value", () => {
      expect(parse("?status=open&status=closed").status).toBe("open");
    });

    // CASE-167bc56de8f8
    it("should ignore an unrecognised param without disturbing the rest", () => {
      expect(parse("?assignee=me&status=open")).toEqual({
        ...defaults,
        status: "open",
      });
    });

    // CASE-4cf6ae359e0d — nothing invalid survives, so the request cannot 400
    it("should return an entirely valid state from an entirely invalid query string", () => {
      expect(
        parse(
          "?status=frozen&category=billing&sortBy=senderEmail&sortOrder=sideways&page=abc"
        )
      ).toEqual(defaults);
    });

    // CASE-7f01d782c90b
    it("should return defaults for a malformed query string", () => {
      expect(parse("?%%%&=&status")).toEqual(defaults);
    });
  });
});

describe("serializeTicketListParams", () => {
  const serialize = (params: Partial<TicketListParams>) =>
    serializeTicketListParams({ ...defaults, ...params }).toString();

  // AC8 — CASE-c676aa4d6c2f, CASE-76b3900894f2, CASE-c9644e6ae50c
  it("should produce an empty query string for the default state", () => {
    expect(serialize({})).toBe("");
  });

  // AC8 — CASE-f4b2c0c285fa, CASE-70b9f471d1ea
  it("should omit filters that are absent", () => {
    expect(serialize({ status: "open" })).toBe("status=open");
  });

  // AC1
  it("should write every filter that is set", () => {
    expect(
      serialize({ status: "open", category: "refund_request", search: "login" })
    ).toBe("status=open&category=refund_request&search=login");
  });

  // AC2 — the sort is written as a pair, so a URL mentioning sort says column and direction
  it("should write sortBy and sortOrder together when the sort is not the default", () => {
    expect(serialize({ sortBy: "subject", sortOrder: "asc" })).toBe(
      "sortBy=subject&sortOrder=asc"
    );
  });

  it("should write both halves of the sort when only the direction differs", () => {
    expect(serialize({ sortBy: DEFAULT_SORT_BY, sortOrder: "asc" })).toBe(
      "sortBy=createdAt&sortOrder=asc"
    );
  });

  // AC8 — CASE-c9644e6ae50c
  it("should omit page 1", () => {
    expect(serialize({ page: 1 })).toBe("");
  });

  it("should write a page beyond the first", () => {
    expect(serialize({ page: 3 })).toBe("page=3");
  });

  // AC1 — CASE-655998d07a02
  it("should encode a search term containing URL-reserved characters", () => {
    expect(serialize({ search: "a&b=c?d#e" })).toBe("search=a%26b%3Dc%3Fd%23e");
  });
});

describe("round trip", () => {
  // AC8 — CASE-2ce11011a545: what serialize writes, parse reads back unchanged
  it.each<Partial<TicketListParams>>([
    {},
    { status: "resolved" },
    { category: "general_question" },
    { search: "vpn access" },
    { search: "a&b=c?d#e" },
    { sortBy: "subject", sortOrder: "asc" },
    { sortBy: "status", sortOrder: "desc" },
    { page: 7 },
    {
      status: "closed",
      category: "refund_request",
      search: "login",
      sortBy: "senderName",
      sortOrder: "asc",
      page: 2,
    },
  ])("should survive serialize then parse: %o", (partial) => {
    const params = { ...defaults, ...partial };
    expect(
      parseTicketListParams(serializeTicketListParams(params))
    ).toEqual(params);
  });
});
