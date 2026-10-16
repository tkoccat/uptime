// Uygulama genelinde kullanılan, kullanıcıya gösterilebilir hatalar.

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
  }
}

// Başkasına ait kaynak da "bulunamadı" döner: varlığı sızdırılmaz
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, "not_found", 404);
  }
}

export class PlanLimitError extends AppError {
  constructor(
    message: string,
    readonly limit: "monitors" | "interval" | "statusPages" | "customDomain" | "api"
  ) {
    super(message, "plan_limit", 402);
  }
}

export class RateLimitError extends AppError {
  constructor(readonly retryAfterSec: number) {
    super("Too many requests", "rate_limited", 429);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "validation", 400);
  }
}
