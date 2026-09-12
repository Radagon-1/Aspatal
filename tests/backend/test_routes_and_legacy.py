"""
Test 25/30 + general route/OpenAPI verification: /triage must remain
registered and untouched, all Phase 6.1 explicit action endpoints must be
present, and the superseded generic /transitions endpoint must NOT be
publicly exposed.
"""


def _effective_paths(app):
    schema = app.openapi()
    return schema["paths"]


def test_triage_route_still_registered():
    from app.main import app

    paths = _effective_paths(app)
    assert "/triage" in paths
    assert "post" in paths["/triage"]


def test_expected_api_routes_registered():
    from app.main import app

    paths = _effective_paths(app)
    expected = {
        "/api/patients": {"post"},
        "/api/patients/{patient_id}": {"get"},
        "/api/assessments": {"post"},
        "/api/assessments/{assessment_id}": {"get"},
        "/api/facilities": {"get"},
        "/api/facilities/{facility_id}": {"get"},
        "/api/referrals": {"post", "get"},
        "/api/referrals/{referral_id}": {"get"},
        "/api/referrals/{referral_id}/events": {"get"},
        "/api/referrals/{referral_id}/acknowledge": {"post"},
        "/api/referrals/{referral_id}/decline": {"post"},
        "/api/referrals/{referral_id}/cancel": {"post"},
        "/api/referrals/{referral_id}/arrive": {"post"},
        "/api/referrals/{referral_id}/no-show": {"post"},
        "/api/referrals/{referral_id}/consult": {"post"},
        "/api/referrals/{referral_id}/follow-up": {"post"},
        "/api/referrals/{referral_id}/close": {"post"},
        "/api/referrals/{referral_id}/complete-follow-up": {"post"},
        "/api/follow-ups/overdue": {"get"},
    }
    for path, methods in expected.items():
        assert path in paths, f"missing route: {path}"
        assert methods.issubset(paths[path].keys()), f"missing methods on {path}: {methods - paths[path].keys()}"


# 24. preferably no public generic /transitions endpoint
def test_generic_transitions_endpoint_not_exposed():
    from app.main import app

    paths = _effective_paths(app)
    assert "/api/referrals/{referral_id}/transitions" not in paths


def test_openapi_schema_generates_without_error():
    from app.main import app

    schema = app.openapi()
    assert schema["openapi"]
    schema_names = schema["components"]["schemas"].keys()
    for expected in ("ReferralOut", "ReferralEventOut", "PatientOut", "FacilityOut", "FollowUpOut", "AssessmentOut"):
        assert any(expected in name for name in schema_names), f"missing schema: {expected}"


# 23. no generic referral PUT
def test_no_generic_put_referral_route_exists():
    from app.main import app

    paths = _effective_paths(app)
    assert "put" not in paths.get("/api/referrals/{referral_id}", {})
