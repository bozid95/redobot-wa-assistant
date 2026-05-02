export type PaginationQuery = {
  page?: string | number;
  limit?: string | number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export function hasPaginationQuery(query: PaginationQuery = {}) {
  return query.page != null || query.limit != null;
}

export function sanitizePagination(query: PaginationQuery = {}, defaultLimit = 10, maxLimit = 50) {
  const parsedPage = Number(query.page || 1);
  const parsedLimit = Number(query.limit || defaultLimit);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, maxLimit)
      : defaultLimit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function buildPagination(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    page,
    limit,
    total,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    pagination: buildPagination(total, page, limit),
  };
}
