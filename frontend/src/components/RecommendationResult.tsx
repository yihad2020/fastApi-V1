import type { AssignmentSuggestion } from "../types/assignments";

interface RecommendationResultProps {
  result: AssignmentSuggestion | null;
  loading: boolean;
}

interface SkillListProps {
  title: string;
  skills: string[];
  tone: "positive" | "neutral";
  emptyMessage: string;
}

function SkillList({ title, skills, tone, emptyMessage }: SkillListProps) {
  return (
    <div className="skill-group">
      <div className="skill-label">
        <span>{title}</span>
        <strong>{skills.length}</strong>
      </div>
      <div className="skill-chips">
        {skills.length > 0 ? (
          skills.map((skill) => (
            <span className={`skill-chip skill-chip-${tone}`} key={skill}>
              {tone === "positive" && <span aria-hidden="true">✓</span>}
              {skill}
            </span>
          ))
        ) : (
          <span className="skill-empty">{emptyMessage}</span>
        )}
      </div>
    </div>
  );
}

export function RecommendationResult({
  result,
  loading,
}: RecommendationResultProps) {
  if (loading) {
    return (
      <aside className="result-card result-loading" aria-live="polite">
        <div className="result-placeholder-icon">
          <span className="spinner spinner-dark" aria-hidden="true" />
        </div>
        <h2>Evaluating the team</h2>
        <p>Comparing department, skills, availability, and workload.</p>
      </aside>
    );
  }

  if (!result) {
    return (
      <aside className="result-card result-empty">
        <div className="result-placeholder-icon" aria-hidden="true">◎</div>
        <span className="eyebrow">Recommendation</span>
        <h2>Your result will appear here</h2>
        <p>
          Complete the request and candidate information to see the best qualified
          assignee with a transparent score explanation.
        </p>
        <div className="criteria-list">
          <span>Department fit</span>
          <span>Skill coverage</span>
          <span>Current workload</span>
        </div>
      </aside>
    );
  }

  const recommendation = result.most_qualified;
  const employee = recommendation.employee;
  const initials = employee.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <aside className="result-card result-success" aria-live="polite">
      <div className="success-header">
        <div>
          <span className="success-kicker">
            <span aria-hidden="true">✓</span> Recommendation ready
          </span>
          <small>Request {result.request_id}</small>
        </div>
        <div className="score-ring" aria-label={`${recommendation.qualification_score} out of 100`}>
          <strong>{recommendation.qualification_score}</strong>
          <span>/100</span>
        </div>
      </div>

      <div className="employee-profile">
        <div className="avatar" aria-hidden="true">{initials}</div>
        <div>
          <span>Best qualified assignee</span>
          <h2>{employee.name}</h2>
          <p>{employee.department}</p>
        </div>
      </div>

      <div className="result-metrics">
        <div>
          <span>Department match</span>
          <strong>{recommendation.department_match ? "Yes" : "No"}</strong>
        </div>
        <div>
          <span>Active requests</span>
          <strong>{employee.active_requests}</strong>
        </div>
        <div>
          <span>Evaluated</span>
          <strong>{result.evaluated_candidates}</strong>
        </div>
      </div>

      <SkillList
        title="Matched skills"
        skills={recommendation.matched_skills}
        tone="positive"
        emptyMessage="No direct skill matches"
      />
      <SkillList
        title="Missing skills"
        skills={recommendation.missing_skills}
        tone="neutral"
        emptyMessage="No missing skills"
      />

      <div className="reason-box">
        <span>Why this person?</span>
        <p>{recommendation.reason}</p>
      </div>
    </aside>
  );
}
