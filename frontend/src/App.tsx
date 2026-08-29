import { useState } from "react";
import { AssignmentApiError, suggestAssignment } from "./api/assignments";
import { AssignmentForm } from "./components/AssignmentForm";
import { RecommendationResult } from "./components/RecommendationResult";
import type {
  AssignmentRequestPayload,
  AssignmentSuggestion,
} from "./types/assignments";

function App() {
  const [result, setResult] = useState<AssignmentSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleSubmit = async (payload: AssignmentRequestPayload) => {
    setLoading(true);
    setApiError(null);
    setResult(null);

    try {
      const suggestion = await suggestAssignment(payload);
      setResult(suggestion);
    } catch (error: unknown) {
      setApiError(
        error instanceof AssignmentApiError
          ? error.message
          : "An unexpected error occurred while requesting the recommendation.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#top" aria-label="Assignment Console home">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>
            <strong>Assignment</strong>
            <small>Operations Console</small>
          </span>
        </a>
        <div className="api-status">
          <span className="status-dot" aria-hidden="true" />
          Day 1 API
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div>
            <span className="eyebrow">Smart workload routing</span>
            <h1>Find the right owner for every request.</h1>
            <p>
              Compare department fit, required skills, and current workload with
              a recommendation your operations team can understand.
            </p>
          </div>
          <div className="hero-note">
            <strong>Transparent by design</strong>
            <span>No black-box scoring</span>
          </div>
        </section>

        <section className="workspace" aria-label="Assignment recommendation workspace">
          <AssignmentForm
            loading={loading}
            apiError={apiError}
            onSubmit={handleSubmit}
          />
          <RecommendationResult result={result} loading={loading} />
        </section>
      </main>

      <footer>
        Internal operations tool · Recommendations remain subject to manager review
      </footer>
    </div>
  );
}

export default App;
