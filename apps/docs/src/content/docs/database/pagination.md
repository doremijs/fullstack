---
title: 分页
description: 使用 limit / offset 实现数据分页
---

VentoStack 的查询构建器通过 `limit` 和 `offset` 实现分页，没有单独的 `createPaginator` 函数。

## 基于页码的分页

```typescript
router.get("/users", async (ctx) => {
  const page = Number(ctx.query.page ?? 1);
  const limit = Number(ctx.query.limit ?? 20);
  const offset = (page - 1) * limit;

  const data = await db
    .query(UserModel)
    .where("active", "=", true)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .offset(offset)
    .list();

  const total = await db.query(UserModel).where("active", "=", true).count();
  const totalPages = Math.ceil(total / limit);

  return ctx.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});
```

响应示例：

```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

## 基于游标的分页（无限滚动）

游标分页性能更优，适合大数据集和无限滚动场景。利用 `where` + `orderBy` + `limit` 实现：

```typescript
router.get("/feed", async (ctx) => {
  const cursor = ctx.query.cursor;
  const limit = Number(ctx.query.limit ?? 20);

  const query = db
    .query(PostModel)
    .where("published", "=", true)
    .orderBy("createdAt", "desc")
    .limit(limit + 1); // 多取一条判断是否有更多

  if (cursor) {
    query.where("createdAt", "<", new Date(cursor));
  }

  const rows = await query.list();
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1]?.createdAt.toISOString() : undefined;

  return ctx.json({
    data,
    nextCursor,
    hasMore,
  });
});
```

响应示例：

```json
{
  "data": [...],
  "nextCursor": "2024-01-15T10:30:00.000Z",
  "hasMore": true
}
```

客户端下次请求时传入 `?cursor=2024-01-15T10:30:00.000Z`。

## 注意事项

- 框架未提供 `createPaginator` 或 `cursorPaginate` 等高层封装，需自行组合 `limit` / `offset` / `count` / `where` 实现
- `QueryExecutor` 提供 `count()` 方法用于获取总行数
- 游标分页需要确保游标字段上有索引，且排序方向与查询条件一致
