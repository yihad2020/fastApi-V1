"""Automated tests for the Day 1 assignment recommendation contract."""

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)
ENDPOINT = "/api/v1/assignments/suggest"


def employee(
    employee_id: int,
    name: str,
    department: str,
    skills: list[str],
    active_requests: int = 0,
    available: bool = True,
) -> dict:
    return {
        "id": employee_id,
        "name": name,
        "department": department,
        "skills": skills,
        "active_requests": active_requests,
        "available": available,
    }


def payload(candidates: list[dict]) -> dict:
    return {
        "request": {
            "id": "REQ-001",
            "department": "Engineering",
            "priority": "high",
            "required_skills": ["Python", "FastAPI"],
        },
        "candidates": candidates,
    }


def test_best_department_and_skill_match_wins() -> None:
    response = client.post(
        ENDPOINT,
        json=payload(
            [
                employee(1, "Ana", "Engineering", ["Python", "FastAPI"], 1),
                employee(2, "Ben", "Finance", ["Python", "FastAPI"], 0),
                employee(3, "Cara", "Engineering", ["Excel"], 0),
            ]
        ),
    )

    assert response.status_code == 200
    result = response.json()
    assert result["most_qualified"]["employee"]["id"] == 1
    assert result["most_qualified"]["qualification_score"] == 96


def test_unavailable_candidate_is_excluded() -> None:
    response = client.post(
        ENDPOINT,
        json=payload(
            [
                employee(1, "Ana", "Engineering", ["Python", "FastAPI"], 0, False),
                employee(2, "Ben", "Engineering", ["Python"], 2, True),
            ]
        ),
    )

    assert response.status_code == 200
    result = response.json()
    assert result["most_qualified"]["employee"]["id"] == 2
    assert result["evaluated_candidates"] == 1


def test_lower_workload_resolves_score_tie() -> None:
    # Employee 1: 0 department + 30 skills + 20 workload = 50.
    # Employee 2: 50 department + 0 skills + 0 workload = 50.
    # Their scores tie, so the lower workload wins.
    response = client.post(
        ENDPOINT,
        json=payload(
            [
                employee(1, "Ana", "Finance", ["Python", "FastAPI"], 0),
                employee(2, "Ben", "Engineering", ["Excel"], 5),
            ]
        ),
    )

    assert response.status_code == 200
    assert response.json()["most_qualified"]["employee"]["id"] == 1


def test_employee_id_resolves_complete_tie() -> None:
    response = client.post(
        ENDPOINT,
        json=payload(
            [
                employee(20, "Zoe", "Engineering", ["Python", "FastAPI"], 1),
                employee(10, "Amy", "Engineering", ["Python", "FastAPI"], 1),
            ]
        ),
    )

    assert response.status_code == 200
    assert response.json()["most_qualified"]["employee"]["id"] == 10


def test_no_available_candidate_returns_not_found() -> None:
    response = client.post(
        ENDPOINT,
        json=payload(
            [
                employee(1, "Ana", "Engineering", ["Python"], 0, False),
                employee(2, "Ben", "Engineering", ["FastAPI"], 0, False),
            ]
        ),
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "No candidates are currently available"


def test_negative_active_requests_is_rejected() -> None:
    response = client.post(
        ENDPOINT,
        json=payload([employee(1, "Ana", "Engineering", ["Python"], -1)]),
    )

    assert response.status_code == 422


def test_blank_department_and_skill_are_rejected() -> None:
    blank_department = payload(
        [employee(1, "Ana", "Engineering", ["Python"], 0)]
    )
    blank_department["request"]["department"] = "   "

    blank_skill = payload([employee(1, "Ana", "Engineering", ["Python"], 0)])
    blank_skill["request"]["required_skills"] = ["   "]

    assert client.post(ENDPOINT, json=blank_department).status_code == 422
    assert client.post(ENDPOINT, json=blank_skill).status_code == 422


def test_skill_matching_is_case_insensitive() -> None:
    response = client.post(
        ENDPOINT,
        json={
            "request": {
                "id": "REQ-CASE-001",
                "department": "ENGINEERING",
                "priority": "medium",
                "required_skills": ["  PYTHON  ", "fastAPI", "PYTHON"],
            },
            "candidates": [
                employee(
                    1,
                    "Ana",
                    "engineering",
                    ["python", "FASTapi"],
                    0,
                )
            ],
        },
    )

    assert response.status_code == 200
    result = response.json()["most_qualified"]
    assert result["qualification_score"] == 100
    assert len(result["matched_skills"]) == 2
    assert result["missing_skills"] == []