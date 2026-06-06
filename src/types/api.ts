export interface CursorPaginatedResponse<T> {
  items: T[]
  nextCursor: string | null
  hasNext: boolean
}

export interface OffsetPaginatedResponse<T> {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
