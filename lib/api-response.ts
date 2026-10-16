import { NextResponse } from "next/server";
import { AppError, RateLimitError } from "./errors";

// REST API hatalarını tutarlı JSON yanıtına çevirir; beklenmeyen hatalar ayrıntı sızdırmaz
export function apiError(err: unknown): NextResponse {
  if (err instanceof RateLimitError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: 429, headers: { "Retry-After": String(err.retryAfterSec) } }
    );
  }
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  console.error("[api] beklenmeyen hata", err);
  return NextResponse.json({ error: { code: "internal", message: "Internal error" } }, { status: 500 });
}
