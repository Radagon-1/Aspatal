/**
 * Pagination helper for Prisma queries
 * Supports offset-based pagination with page/limit
 */
export function paginate(query = {}) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  return { skip, take: limit, page, limit };
}

/**
 * Format paginated response
 */
export function paginatedResponse(data, total, { page, limit }) {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
