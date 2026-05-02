export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
}

export type PaginatedResponse<T> = {
  items: T[]
  pagination: PaginationMeta
}

export function defaultPagination(limit = 10): PaginationMeta {
  return {
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  }
}
