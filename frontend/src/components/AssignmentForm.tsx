import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  AssignmentRequestPayload,
  Candidate,
  Priority,
} from "../types/assignments";

interface AssignmentFormProps {
  loading: boolean;
  apiError: string | null;
  onSubmit: (payload: AssignmentRequestPayload) => Promise<void>;
}

interface CandidateDraft {
  key: string;
  id: string;
  name: string;
  department: string;
  skills: string;
  activeRequests: string;
  available: boolean;
}

interface ParsedForm {
  payload: AssignmentRequestPayload | null;
  errors: string[];
}

const priorities: Priority[] = ["low", "medium", "high", "urgent"];

function makeCandidate(sequence: number): CandidateDraft {
  return {
    key: `candidate-${sequence}`,
    id: String(sequence),
    name: "",
    department: "",
    skills: "",
    activeRequests: "0",
    available: true,
  };
}

function parseSkills(value: string): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];

  for (const rawSkill of value.split(",")) {
    const skill = rawSkill.trim();
    const key = skill.toLocaleLowerCase();
    if (skill && !seen.has(key)) {
      seen.add(key);
      skills.push(skill);
    }
  }

  return skills;
}

function parseForm(
  requestId: string,
  department: string,
  priority: Priority,
  requiredSkillsInput: string,
  candidateDrafts: CandidateDraft[],
): ParsedForm {
  const errors: string[] = [];
  const requiredSkills = parseSkills(requiredSkillsInput);

  if (!requestId.trim()) errors.push("Request ID is required.");
  if (!department.trim()) errors.push("Request department is required.");
  if (requiredSkills.length === 0) errors.push("Add at least one required skill.");
  if (candidateDrafts.length === 0) errors.push("Add at least one candidate.");

  const candidates: Candidate[] = candidateDrafts.flatMap((candidate, index) => {
    const label = `Candidate ${index + 1}`;
    const id = Number(candidate.id);
    const activeRequests = Number(candidate.activeRequests);
    const skills = parseSkills(candidate.skills);

    if (!Number.isInteger(id) || id <= 0) {
      errors.push(`${label} needs a positive whole-number ID.`);
    }
    if (!candidate.name.trim()) errors.push(`${label} name is required.`);
    if (!candidate.department.trim()) errors.push(`${label} department is required.`);
    if (skills.length === 0) errors.push(`${label} needs at least one skill.`);
    if (!Number.isInteger(activeRequests) || activeRequests < 0) {
      errors.push(`${label} active requests must be zero or a positive whole number.`);
    }

    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !candidate.name.trim() ||
      !candidate.department.trim() ||
      skills.length === 0 ||
      !Number.isInteger(activeRequests) ||
      activeRequests < 0
    ) {
      return [];
    }

    return [
      {
        id,
        name: candidate.name.trim(),
        department: candidate.department.trim(),
        skills,
        active_requests: activeRequests,
        available: candidate.available,
      },
    ];
  });

  if (errors.length > 0) {
    return { payload: null, errors };
  }

  return {
    payload: {
      request: {
        id: requestId.trim(),
        department: department.trim(),
        priority,
        required_skills: requiredSkills,
      },
      candidates,
    },
    errors: [],
  };
}

export function AssignmentForm({
  loading,
  apiError,
  onSubmit,
}: AssignmentFormProps) {
  const nextCandidateNumber = useRef(2);
  const [requestId, setRequestId] = useState("");
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [candidates, setCandidates] = useState<CandidateDraft[]>([
    makeCandidate(1),
  ]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const parsedForm = useMemo(
    () =>
      parseForm(
        requestId,
        department,
        priority,
        requiredSkills,
        candidates,
      ),
    [requestId, department, priority, requiredSkills, candidates],
  );

  const updateCandidate = <Field extends keyof CandidateDraft>(
    key: string,
    field: Field,
    value: CandidateDraft[Field],
  ) => {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.key === key ? { ...candidate, [field]: value } : candidate,
      ),
    );
  };

  const addCandidate = () => {
    const sequence = nextCandidateNumber.current;
    nextCandidateNumber.current += 1;
    setCandidates((current) => [...current, makeCandidate(sequence)]);
  };

  const removeCandidate = (key: string) => {
    setCandidates((current) => current.filter((candidate) => candidate.key !== key));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationErrors(parsedForm.errors);

    if (parsedForm.payload) {
      void onSubmit(parsedForm.payload);
    }
  };

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Request details</span>
          <h2>What needs an owner?</h2>
        </div>
        <span className="step-pill">1 of 2</span>
      </div>

      <div className="request-grid">
        <label className="field">
          <span>Request ID</span>
          <input
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
            placeholder="REQ-1042"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Department</span>
          <input
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="Engineering"
            autoComplete="organization-title"
          />
        </label>

        <label className="field">
          <span>Priority</span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            {priorities.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="field field-wide">
          <span>Required skills</span>
          <input
            value={requiredSkills}
            onChange={(event) => setRequiredSkills(event.target.value)}
            placeholder="Python, FastAPI, SQL"
            autoComplete="off"
          />
          <small>Separate skills with commas.</small>
        </label>
      </div>

      <div className="section-divider" />

      <div className="section-heading candidates-heading">
        <div>
          <span className="eyebrow">Candidate pool</span>
          <h2>Who can take it?</h2>
        </div>
        <button className="button-secondary" type="button" onClick={addCandidate}>
          <span aria-hidden="true">+</span> Add candidate
        </button>
      </div>

      {candidates.length === 0 ? (
        <div className="empty-state" role="status">
          <div className="empty-icon" aria-hidden="true">+</div>
          <strong>No candidates added</strong>
          <p>Add at least one employee before requesting a recommendation.</p>
          <button className="button-secondary" type="button" onClick={addCandidate}>
            Add first candidate
          </button>
        </div>
      ) : (
        <div className="candidate-list">
          {candidates.map((candidate, index) => (
            <fieldset className="candidate-card" key={candidate.key}>
              <legend>
                <span>Candidate {index + 1}</span>
                <button
                  className="remove-button"
                  type="button"
                  onClick={() => removeCandidate(candidate.key)}
                  aria-label={`Remove candidate ${index + 1}`}
                >
                  Remove
                </button>
              </legend>

              <div className="candidate-grid">
                <label className="field compact-field">
                  <span>Employee ID</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={candidate.id}
                    onChange={(event) =>
                      updateCandidate(candidate.key, "id", event.target.value)
                    }
                  />
                </label>

                <label className="field">
                  <span>Full name</span>
                  <input
                    value={candidate.name}
                    onChange={(event) =>
                      updateCandidate(candidate.key, "name", event.target.value)
                    }
                    placeholder="Sofia Rojas"
                    autoComplete="off"
                  />
                </label>

                <label className="field">
                  <span>Department</span>
                  <input
                    value={candidate.department}
                    onChange={(event) =>
                      updateCandidate(candidate.key, "department", event.target.value)
                    }
                    placeholder="Engineering"
                    autoComplete="off"
                  />
                </label>

                <label className="field field-wide">
                  <span>Skills</span>
                  <input
                    value={candidate.skills}
                    onChange={(event) =>
                      updateCandidate(candidate.key, "skills", event.target.value)
                    }
                    placeholder="Python, FastAPI, React"
                    autoComplete="off"
                  />
                </label>

                <label className="field compact-field">
                  <span>Active requests</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={candidate.activeRequests}
                    onChange={(event) =>
                      updateCandidate(
                        candidate.key,
                        "activeRequests",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label className="availability-field">
                  <input
                    type="checkbox"
                    checked={candidate.available}
                    onChange={(event) =>
                      updateCandidate(
                        candidate.key,
                        "available",
                        event.target.checked,
                      )
                    }
                  />
                  <span>
                    <strong>Available</strong>
                    <small>Include in recommendation</small>
                  </span>
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {(validationErrors.length > 0 || apiError) && (
        <div className="error-banner" role="alert">
          <strong>We couldn’t submit this request.</strong>
          {apiError && <p>{apiError}</p>}
          {validationErrors.length > 0 && (
            <ul>
              {validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="form-actions">
        <div className="privacy-note">
          <span className="status-dot" aria-hidden="true" />
          Uses the live Day 1 scoring API
        </div>
        <button
          className="button-primary"
          type="submit"
          disabled={loading || !parsedForm.payload}
        >
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" /> Evaluating candidates…
            </>
          ) : (
            "Find best assignee"
          )}
        </button>
      </div>
    </form>
  );
}
