export const sortableColumns = [
  "subject",
  "senderName",
  "status",
  "category",
  "createdAt",
] as const;

export type TicketSortField = (typeof sortableColumns)[number];

export const sortOrders = ["asc", "desc"] as const;

export type TicketSortOrder = (typeof sortOrders)[number];
