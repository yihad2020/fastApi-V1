
from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize(value: str) -> str:
    """Return a case-insensitive, whitespace-normalized comparison value."""

    return " ".join(value.casefold().strip().split())


def clean_non_blank(value: str, field_name: str) -> str:
    """Trim repeated whitespace and reject values containing only whitespace."""

    cleaned = " ".join(value.strip().split())
    if not cleaned:
        raise ValueError(f"{field_name} must not be blank")
    return cleaned


def clean_skills(values: list[str]) -> list[str]:
    """Validate and deduplicate skills while preserving their display spelling."""

    cleaned_skills: list[str] = []
    seen: set[str] = set()

    for value in values:
        cleaned = clean_non_blank(value, "skill")
        key = normalize(cleaned)
        if key not in seen:
            seen.add(key)
            cleaned_skills.append(cleaned)

    if not cleaned_skills:
        raise ValueError("at least one non-blank skill is required")

    return cleaned_skills


app = FastAPI(
    title="Requests API",
    description="API for handling requests and suggesting the best assignee.",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


Priority = Literal["low", "medium", "high", "urgent"]


class WorkRequestCreate(BaseModel):
    """Request information accepted from a client."""

    department: str = Field(max_length=100)
    priority: Priority = "medium"
    required_skills: list[str] = Field(min_length=1, max_length=20)

    @field_validator("department")
    @classmethod
    def validate_department(cls, value: str) -> str:
        return clean_non_blank(value, "department")

    @field_validator("required_skills")
    @classmethod
    def validate_required_skills(cls, values: list[str]) -> list[str]:
        return clean_skills(values)


class AssignmentWorkRequest(WorkRequestCreate):
    """Request information evaluated by the assignment endpoint."""

    id: str = Field(max_length=100)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return clean_non_blank(value, "id")


class WorkRequestUpdate(BaseModel):
    """Optional fields accepted when a saved request is updated."""

    department: str | None = Field(default=None, max_length=100)
    priority: Priority | None = None
    required_skills: list[str] | None = Field(
        default=None,
        min_length=1,
        max_length=20,
    )

    @field_validator("department")
    @classmethod
    def validate_department(cls, value: str | None) -> str | None:
        return None if value is None else clean_non_blank(value, "department")

    @field_validator("required_skills")
    @classmethod
    def validate_required_skills(
        cls,
        values: list[str] | None,
    ) -> list[str] | None:
        return None if values is None else clean_skills(values)


class WorkRequest(WorkRequestCreate):
    """Complete persisted request returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


class Employee(BaseModel):
    """Candidate who may receive a request."""

    id: int = Field(gt=0)
    name: str = Field(max_length=100)
    department: str = Field(max_length=100)
    skills: list[str] = Field(min_length=1, max_length=50)
    active_requests: int = Field(ge=0, strict=True)
    available: bool = True

    @field_validator("name", "department")
    @classmethod
    def validate_non_blank_text(cls, value: str) -> str:
        return clean_non_blank(value, "name or department")

    @field_validator("skills")
    @classmethod
    def validate_skills(cls, values: list[str]) -> list[str]:
        return clean_skills(values)


class AssignmentRequest(BaseModel):
    """Required Day 1 request body: one request and its candidates."""

    request: AssignmentWorkRequest
    candidates: list[Employee] = Field(min_length=1, max_length=100)


class QualifiedIndividual(BaseModel):
    """Recommended employee and evidence behind the recommendation."""

    employee: Employee
    qualification_score: int = Field(ge=0, le=100)
    department_match: bool
    matched_skills: list[str]
    missing_skills: list[str]
    reason: str


class AssignmentSuggestion(BaseModel):
    request_id: str
    most_qualified: QualifiedIndividual
    evaluated_candidates: int


class Message(BaseModel):
    message: str


# Demo-only storage for the optional CRUD endpoints.
requests: dict[UUID, WorkRequest] = {}


def evaluate_candidate(
    employee: Employee,
    work_request: WorkRequestCreate,
) -> QualifiedIndividual:
    """Score one employee according to the Day 1 assignment rules.

    - Department match: 50 points
    - Matching skills: 15 points each, maximum 30
    - Workload: max(0, 20 - active_requests * 4)

    Unavailable employees are excluded before this function is called.
    """

    required_by_key = {
        normalize(skill): skill for skill in work_request.required_skills
    }
    employee_skill_keys = {normalize(skill) for skill in employee.skills}

    matched_keys = set(required_by_key) & employee_skill_keys
    matched_skills = [
        required_by_key[key]
        for key in required_by_key
        if key in matched_keys
    ]
    missing_skills = [
        required_by_key[key]
        for key in required_by_key
        if key not in matched_keys
    ]

    department_match = normalize(employee.department) == normalize(
        work_request.department
    )
    department_points = 50 if department_match else 0
    skill_points = min(30, len(matched_skills) * 15)
    workload_points = max(0, 20 - employee.active_requests * 4)
    score = department_points + skill_points + workload_points

    reason = (
        f"{employee.name} scored {score}/100: "
        f"department {department_points}/50, skills {skill_points}/30 "
        f"({len(matched_skills)} matched), and workload {workload_points}/20 "
        f"with {employee.active_requests} active request(s)."
    )

    return QualifiedIndividual(
        employee=employee,
        qualification_score=score,
        department_match=department_match,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        reason=reason,
    )


def rank_candidates(
    candidates: list[Employee],
    work_request: WorkRequestCreate,
) -> list[QualifiedIndividual]:
    """Evaluate available candidates and apply deterministic tie-breaking."""

    ranked = [
        evaluate_candidate(employee, work_request)
        for employee in candidates
        if employee.available
    ]
    ranked.sort(
        key=lambda candidate: (
            -candidate.qualification_score,
            candidate.employee.active_requests,
            candidate.employee.id,
        )
    )
    return ranked


@app.exception_handler(Exception)
async def unexpected_error_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Return a consistent response for unexpected server errors."""

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected server error occurred."},
    )


@app.get("/", tags=["System"])
async def root() -> dict[str, str]:
    return {"message": "API is running", "docs": "/docs"}


@app.get("/health", tags=["System"])
async def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post(
    "/api/v1/assignments/suggest",
    response_model=AssignmentSuggestion,
    tags=["Assignments"],
)
async def suggest_assignee(payload: AssignmentRequest) -> AssignmentSuggestion:
    """Return the best available candidate supplied in the request body."""

    ranked_candidates = rank_candidates(payload.candidates, payload.request)
    if not ranked_candidates:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No candidates are currently available",
        )

    return AssignmentSuggestion(
        request_id=payload.request.id,
        most_qualified=ranked_candidates[0],
        evaluated_candidates=len(ranked_candidates),
    )


@app.get("/api/v1/requests", response_model=list[WorkRequest], tags=["Requests"])
async def list_requests(
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[WorkRequest]:
    results = list(requests.values())

    if search:
        search_value = normalize(search)
        results = [
            item
            for item in results
            if search_value in normalize(item.department)
            or search_value in normalize(item.priority)
            or any(search_value in normalize(skill) for skill in item.required_skills)
        ]

    return results[offset : offset + limit]


@app.post(
    "/api/v1/requests",
    response_model=WorkRequest,
    status_code=status.HTTP_201_CREATED,
    tags=["Requests"],
)
async def create_request(payload: WorkRequestCreate) -> WorkRequest:
    work_request = WorkRequest(
        id=uuid4(),
        created_at=datetime.now(timezone.utc),
        **payload.model_dump(),
    )
    requests[work_request.id] = work_request
    return work_request


@app.get(
    "/api/v1/requests/{request_id}",
    response_model=WorkRequest,
    tags=["Requests"],
)
async def get_request(request_id: UUID) -> WorkRequest:
    work_request = requests.get(request_id)
    if work_request is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return work_request


@app.patch(
    "/api/v1/requests/{request_id}",
    response_model=WorkRequest,
    tags=["Requests"],
)
async def update_request(
    request_id: UUID,
    payload: WorkRequestUpdate,
) -> WorkRequest:
    existing_request = requests.get(request_id)
    if existing_request is None:
        raise HTTPException(status_code=404, detail="Request not found")

    updated_request = existing_request.model_copy(
        update=payload.model_dump(exclude_unset=True)
    )
    requests[request_id] = updated_request
    return updated_request


@app.delete(
    "/api/v1/requests/{request_id}",
    response_model=Message,
    tags=["Requests"],
)
async def delete_request(request_id: UUID) -> Message:
    if requests.pop(request_id, None) is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return Message(message="Request deleted successfully")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
