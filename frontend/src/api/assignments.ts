import type {
  AssignmentRequestPayload,
  AssignmentSuggestion,
  FastApiValidationIssue,
} from "../types/assignments";

const ASSIGNMENT_ENDPOINT = "/api/v1/assignments/suggest";

export class AssignmentApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details: unknown = null) {
    super(message);
    this.name = "AssignmentApiError";
    this.status = status;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidationIssue(value: unknown): value is FastApiValidationIssue {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.loc) &&
    typeof value.msg === "string" &&
    typeof value.type === "string"
  );
}

function messageFromResponse(status: number, body: unknown): string {
  if (status === 404) {
    return "No available candidates were found. Mark at least one candidate as available and try again.";
  }

  if (status === 422 && isRecord(body) && Array.isArray(body.detail)) {
    const issues = body.detail.filter(isValidationIssue);
    if (issues.length > 0) {
      return issues
        .map((issue) => {
          const field = issue.loc.slice(1).join(" → ");
          return `${field || "Request"}: ${issue.msg}`;
        })
        .join(" ");
    }
  }

  if (isRecord(body) && typeof body.detail === "string") {
    return body.detail;
  }

  return status >= 500
    ? "The server could not process the recommendation. Please try again."
    : "The recommendation request could not be completed.";
}

export async function suggestAssignment(
  payload: AssignmentRequestPayload,
): Promise<AssignmentSuggestion> {
  let response: Response;

  try {
    response = await fetch(ASSIGNMENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "Unknown network error";
    throw new AssignmentApiError(
      0,
      "Could not reach the API. Confirm that the FastAPI server is running on port 8000.",
      detail,
    );
  }

  let body: unknown = null;
  try {
    body = (await response.json()) as unknown;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new AssignmentApiError(
      response.status,
      messageFromResponse(response.status, body),
      body,
    );
  }

  return body as AssignmentSuggestion;
}
