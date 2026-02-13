import type { APIRoute } from "astro";
import { z } from "zod";
import { getDatabase } from "@/lib/db/connection";
import { performLookup } from "@/lib/api/lookup";
import {
  successResponse,
  jsonResponse,
  errors,
  extractLocale,
  generateRequestId,
} from "@/lib/api/utils";

const LookupSchema = z.object({
  address: z.string().min(3).max(500),
  city: z.string().max(100).optional(),
  province: z.string().max(2).optional(),
  postal_code: z
    .string()
    .regex(/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/)
    .optional(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = generateRequestId();
  const locale = extractLocale(request);

  try {
    const body = await request.json();
    const parsed = LookupSchema.safeParse(body);

    if (!parsed.success) {
      return errors.badRequest(
        "Invalid request body",
        parsed.error.flatten().fieldErrors
      );
    }

    const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
    const sql = getDatabase(env as Parameters<typeof getDatabase>[0]);

    const apiKey = (env.GOOGLE_PLACES_API_KEY as string | undefined)
      ?? import.meta.env.GOOGLE_PLACES_API_KEY
      ?? undefined;
    const geocodeProvider = (env.GEOCODE_PROVIDER as string | undefined)
      ?? import.meta.env.GEOCODE_PROVIDER
      ?? (apiKey ? "google" : "mock");

    const result = await performLookup(
      sql,
      parsed.data,
      {
        GEOCODE_PROVIDER: geocodeProvider,
        GOOGLE_PLACES_API_KEY: apiKey,
      },
      locale
    );

    if (!result) {
      return errors.noPHHMatch();
    }

    return jsonResponse(
      successResponse(result, {
        request_id: requestId,
        locale,
        cached: false,
      })
    );
  } catch (err) {
    console.error(`[${requestId}] Lookup error:`, err);
    return errors.serverError();
  }
};
