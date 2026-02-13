import type { APIResponse, APIMeta, Locale } from "@/types";

/**
 * Generate a unique request ID.
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a success API response.
 */
export function successResponse<T>(
  data: T,
  meta: Partial<APIMeta> = {}
): APIResponse<T> {
  return {
    data,
    error: null,
    meta: {
      request_id: meta.request_id ?? generateRequestId(),
      timestamp: meta.timestamp ?? new Date().toISOString(),
      cached: meta.cached ?? false,
      locale: meta.locale ?? "en",
    },
  };
}

/**
 * Build an error API response.
 */
export function errorResponse(
  code: string,
  message: string,
  details?: unknown,
  meta: Partial<APIMeta> = {}
): APIResponse<null> {
  return {
    data: null,
    error: { code, message, details },
    meta: {
      request_id: meta.request_id ?? generateRequestId(),
      timestamp: meta.timestamp ?? new Date().toISOString(),
      cached: false,
      locale: meta.locale ?? "en",
    },
  };
}

/**
 * Create a JSON response with proper headers.
 */
export function jsonResponse<T>(
  body: APIResponse<T>,
  status: number = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": body.meta.request_id,
      "Cache-Control": body.meta.cached
        ? "public, max-age=300, s-maxage=600"
        : "no-cache",
    },
  });
}

/**
 * Common error responses.
 */
export const errors = {
  badRequest: (message: string, details?: unknown) =>
    jsonResponse(errorResponse("BAD_REQUEST", message, details), 400),

  notFound: (message: string = "Resource not found") =>
    jsonResponse(errorResponse("NOT_FOUND", message), 404),

  serverError: (message: string = "Internal server error") =>
    jsonResponse(errorResponse("INTERNAL_ERROR", message), 500),

  geocodeFailed: () =>
    jsonResponse(
      errorResponse(
        "GEOCODE_FAILED",
        "Could not geocode the provided address. Please check the address and try again."
      ),
      422
    ),

  noPHHMatch: () =>
    jsonResponse(
      errorResponse(
        "NO_PHH_MATCH",
        "No coverage data found near this address. The location may be outside our current data coverage."
      ),
      404
    ),

  rateLimited: () =>
    jsonResponse(
      errorResponse("RATE_LIMITED", "Too many requests. Please try again later."),
      429
    ),
};

/**
 * Extract locale from request (URL path or Accept-Language header).
 */
export function extractLocale(request: Request): Locale {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/fr/") || url.searchParams.get("lang") === "fr") {
    return "fr";
  }
  const acceptLang = request.headers.get("Accept-Language") ?? "";
  if (acceptLang.startsWith("fr")) {
    return "fr";
  }
  return "en";
}

/**
 * Generate a lookup ID for shareable result URLs.
 */
export function generateLookupId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}${random}`;
}
