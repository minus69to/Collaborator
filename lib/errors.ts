export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}

export function unauthorized(message = "Unauthorized"): HttpError {
  return new HttpError(401, message);
}

export function forbidden(message = "Forbidden"): HttpError {
  return new HttpError(403, message);
}

export function notFound(message = "Not Found"): HttpError {
  return new HttpError(404, message);
}

export function conflict(message = "Conflict"): HttpError {
  return new HttpError(409, message);
}

export function serverError(message = "Internal Server Error", cause?: unknown): HttpError {
  return new HttpError(500, message, cause);
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("Unhandled error", error);
  return Response.json({ error: "Internal Server Error" }, { status: 500 });
}

