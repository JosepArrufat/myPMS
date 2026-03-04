import type { Request } from 'express'

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export const parsePagination = (req: Request): PaginationParams => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit as string) || DEFAULT_LIMIT))
  return { page, limit, offset: (page - 1) * limit }
}

export const paginate = <T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResponse<T> => ({
  data,
  pagination: {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.ceil(total / params.limit),
  },
})
