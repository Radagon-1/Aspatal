"""
Fix B: GET /api/patients?query= -- practical case-insensitive lookup,
alongside GET /api/patients/{patient_id} (no route conflict since the
shapes are structurally distinct).
"""
from conftest import actor_headers, idem_key


def _create_patient(client, worker, full_name, phone=None):
    body = {"full_name": full_name, "approximate_age": 30}
    if phone:
        body["phone"] = phone
    resp = client.post(
        "/api/patients",
        json=body,
        headers={**actor_headers(worker), "Idempotency-Key": idem_key()},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_search_by_name_case_insensitive(client, worker):
    _create_patient(client, worker, "Ramesh Kumar")
    _create_patient(client, worker, "Sita Devi")

    resp = client.get("/api/patients", params={"query": "ramesh"}, headers=actor_headers(worker))
    assert resp.status_code == 200
    names = [p["full_name"] for p in resp.json()]
    assert "Ramesh Kumar" in names
    assert "Sita Devi" not in names


def test_search_by_partial_name(client, worker):
    _create_patient(client, worker, "Ramesh Kumar")

    resp = client.get("/api/patients", params={"query": "kumar"}, headers=actor_headers(worker))
    names = [p["full_name"] for p in resp.json()]
    assert "Ramesh Kumar" in names


def test_search_by_phone(client, worker):
    _create_patient(client, worker, "Ramesh Kumar", phone="9876543210")
    _create_patient(client, worker, "Sita Devi", phone="9123456789")

    resp = client.get("/api/patients", params={"query": "98765"}, headers=actor_headers(worker))
    names = [p["full_name"] for p in resp.json()]
    assert "Ramesh Kumar" in names
    assert "Sita Devi" not in names


def test_search_no_query_returns_all(client, worker):
    _create_patient(client, worker, "Ramesh Kumar")
    _create_patient(client, worker, "Sita Devi")

    resp = client.get("/api/patients", headers=actor_headers(worker))
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


def test_search_no_match_returns_empty_list(client, worker):
    _create_patient(client, worker, "Ramesh Kumar")

    resp = client.get("/api/patients", params={"query": "nonexistent-xyz"}, headers=actor_headers(worker))
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_patient_by_id_still_works_alongside_search(client, worker):
    created = _create_patient(client, worker, "Ramesh Kumar")

    resp = client.get(f"/api/patients/{created['id']}", headers=actor_headers(worker))
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]

    search_resp = client.get("/api/patients", params={"query": "ramesh"}, headers=actor_headers(worker))
    assert search_resp.status_code == 200
