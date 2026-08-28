# Smart Assignment API

A FastAPI service that evaluates available employees and recommends the most qualified owner for an operational request using transparent, deterministic scoring.

This project is **Day 1 of my 90-Day Product Engineer Challenge**, focused on building production-minded features with clear business rules, validation, testing, and documented engineering decisions.

## What it does

The API receives:

- A request ID, department, priority, and required skills.
- A list of candidate employees with departments, skills, availability, and active workloads.

It excludes unavailable candidates, scores the remaining employees, applies deterministic tie-breakers, and returns the strongest candidate with an explanation of the result.

## Scoring model

| Criterion | Points |
| --- | ---: |
| Department match | 50 |
| Matching required skills | 15 per skill, maximum 30 |
| Workload | `max(0, 20 - active_requests × 4)` |
| Maximum total | 100 |

Ties are resolved by:

1. Lowest number of active requests.
2. Lowest employee ID.

Unavailable employees are excluded before scoring.

## Technology

- Python 3.12+
- FastAPI
- Pydantic
- Uvicorn
- Pytest
- HTTPX / FastAPI `TestClient`

## Project structure

```text
day1/
├── .gitignore
└── app/
    ├── __init__.py
    ├── main.py
    └── tests/
        └── test_assignments.py
```

## Local setup

From the project root, create a virtual environment:

```bash
python -m venv .venv
```

Activate it in Git Bash on Windows:

```bash
source .venv/Scripts/activate
```

Install the dependencies:

```bash
python -m pip install --upgrade pip
python -m pip install fastapi "uvicorn[standard]" pytest httpx
```

Start the development server:

```bash
python -m uvicorn app.main:app --reload
```

The API will be available at:

- API root: <http://127.0.0.1:8000>
- Interactive Swagger documentation: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/health>

## Main endpoint

### Suggest an assignee

```http
POST /api/v1/assignments/suggest
```

Example request:

```json
{
  "request": {
    "id": "REQ-001",
    "department": "Engineering",
    "priority": "high",
    "required_skills": ["Python", "FastAPI"]
  },
  "candidates": [
    {
      "id": 1,
      "name": "Ana Reyes",
      "department": "Engineering",
      "skills": ["Python", "FastAPI", "SQL"],
      "active_requests": 1,
      "available": true
    },
    {
      "id": 2,
      "name": "Carlos Mendoza",
      "department": "Finance",
      "skills": ["Python", "FastAPI"],
      "active_requests": 0,
      "available": true
    }
  ]
}
```

Example response:

```json
{
  "request_id": "REQ-001",
  "most_qualified": {
    "employee": {
      "id": 1,
      "name": "Ana Reyes",
      "department": "Engineering",
      "skills": ["Python", "FastAPI", "SQL"],
      "active_requests": 1,
      "available": true
    },
    "qualification_score": 96,
    "department_match": true,
    "matched_skills": ["Python", "FastAPI"],
    "missing_skills": [],
    "reason": "Ana Reyes scored 96/100: department 50/50, skills 30/30 (2 matched), and workload 16/20 with 1 active request(s)."
  },
  "evaluated_candidates": 2
}
```

If no candidate is available, the endpoint returns `404 Not Found`.

## Additional endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | API status and documentation link |
| `GET` | `/health` | Health status and UTC timestamp |
| `POST` | `/api/v1/requests` | Create an in-memory request |
| `GET` | `/api/v1/requests` | List and search requests |
| `GET` | `/api/v1/requests/{request_id}` | Retrieve one request |
| `PATCH` | `/api/v1/requests/{request_id}` | Partially update a request |
| `DELETE` | `/api/v1/requests/{request_id}` | Delete a request |

## Testing

Run the automated test suite from the project root:

```bash
python -m pytest app/tests -q
```

The suite verifies:

- Department and skill scoring.
- Exclusion of unavailable candidates.
- Workload and employee-ID tie-breakers.
- Case-insensitive skill matching and deduplication.
- Request-ID preservation.
- Rejection of blank values and negative workloads.
- `404` behavior when no candidate is available.

Current result:

```text
8 passed
```

## Engineering decisions

- **Deterministic before AI:** The first implementation establishes an explainable and testable baseline before introducing model-based recommendations.
- **Transparent scoring:** The response exposes matches, missing skills, individual score components, and the final recommendation reason.
- **Normalized comparisons:** Departments and skills are compared without case or excess-whitespace sensitivity.
- **Stable outcomes:** Explicit tie-breakers ensure identical input always produces the same recommendation.
- **Boundary validation:** Pydantic rejects malformed IDs, blank values, invalid priorities, negative workloads, and oversized collections.

## Current limitations

- Request CRUD data is stored in memory and resets when the server restarts.
- The service does not yet include authentication or role-based authorization.
- The assignment engine uses business rules rather than machine learning or an LLM.
- Candidate data must currently be supplied in the assignment request.

## Planned improvements

- PostgreSQL persistence.
- Authentication and role-based access control.
- Configurable scoring policies.
- AI-assisted recommendations with confidence scores and human overrides.
- React and TypeScript management interface.
- Docker, CI/CD, monitoring, and cloud deployment.

## Author

**Yihad Salek Villalba**  
Software Engineer / Product Engineer  
[GitHub](https://github.com/yihad2020)
