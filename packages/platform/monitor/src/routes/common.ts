/**
 * 通用响应辅助函数
 */

export function ok(data: unknown) {
  return new Response(JSON.stringify({ code: 0, data }), {
    headers: { "Content-Type": "application/json" },
  });
}

export function fail(message: string, code = 500, status = 200) {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
