import { NextResponse } from "next/server";

export function successResponse<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ data, meta: meta ?? {} }, { status });
}

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export const Errors = {
  UNAUTHORIZED: () => errorResponse("UNAUTHORIZED", "Authentication required", 401),
  FORBIDDEN: () => errorResponse("FORBIDDEN", "Insufficient permissions", 403),
  NOT_FOUND: (resource = "Resource") =>
    errorResponse("NOT_FOUND", `${resource} not found`, 404),
  BAD_REQUEST: (message: string) => errorResponse("BAD_REQUEST", message, 400),
  INTERNAL: () => errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500),
};
