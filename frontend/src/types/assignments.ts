export type Priority = "low" | "medium" | "high" | "urgent";

export interface AssignmentRequestDetails {
  id: string;
  department: string;
  priority: Priority;
  required_skills: string[];
}

export interface Candidate {
  id: number;
  name: string;
  department: string;
  skills: string[];
  active_requests: number;
  available: boolean;
}

export interface AssignmentRequestPayload {
  request: AssignmentRequestDetails;
  candidates: Candidate[];
}

export interface QualifiedIndividual {
  employee: Candidate;
  qualification_score: number;
  department_match: boolean;
  matched_skills: string[];
  missing_skills: string[];
  reason: string;
}

export interface AssignmentSuggestion {
  request_id: string;
  most_qualified: QualifiedIndividual;
  evaluated_candidates: number;
}

export interface FastApiValidationIssue {
  loc: Array<string | number>;
  msg: string;
  type: string;
}
