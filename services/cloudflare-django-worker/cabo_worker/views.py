"""Privacy-minimised, deterministic learning insights; never final grading."""
import hmac
import json
import os
import re

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

_CODE = re.compile(r"^[a-z][a-z0-9_-]{1,47}$")
_MAX_BYTES = 4096


def _required_token():
    # Python Workers provide secrets through the bindings environment.
    try:
        from workers import env
        return str(env.DJANGO_WORKER_TOKEN)
    except (ImportError, AttributeError):
        return os.environ.get("DJANGO_WORKER_TOKEN", "")


def _private(response):
    response["Cache-Control"] = "no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


def health(request):
    # Deliberately contains no institution, learner, secret, database or model data.
    return _private(JsonResponse({"service": "cabo-learning-django-insights", "status": "ok"}))


@csrf_exempt  # Protected by a server-to-server bearer token, not browser cookies.
@require_POST
def insights_draft(request):
    expected = _required_token()
    auth = request.headers.get("Authorization", "")
    supplied = auth[len("Bearer "):] if auth.startswith("Bearer ") else ""
    if not expected or not supplied or not hmac.compare_digest(expected, supplied):
        return _private(JsonResponse({"error": "Unauthorized"}, status=401))
    if request.content_type != "application/json" or len(request.body) > _MAX_BYTES:
        return _private(JsonResponse({"error": "Invalid content type or body size"}, status=400))
    try:
        payload = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return _private(JsonResponse({"error": "Invalid JSON"}, status=400))
    if not isinstance(payload, dict) or set(payload) != {"concepts"}:
        return _private(JsonResponse({"error": "Invalid input"}, status=400))
    concepts = payload["concepts"]
    if not isinstance(concepts, list) or not (1 <= len(concepts) <= 20):
        return _private(JsonResponse({"error": "Invalid concept count"}, status=400))
    results = []
    codes = set()
    for entry in concepts:
        if not isinstance(entry, dict) or set(entry) != {"code", "masteryPercent", "evidenceCount"}:
            return _private(JsonResponse({"error": "Invalid concept fields"}, status=400))
        code = entry["code"]
        pct = entry["masteryPercent"]
        count = entry["evidenceCount"]
        if (not isinstance(code, str) or not _CODE.fullmatch(code) or code in codes
            or type(pct) is not int or pct < 0 or pct > 100
            or type(count) is not int or count < 0 or count > 500):
            return _private(JsonResponse({"error": "Invalid concept metric"}, status=400))
        codes.add(code)
        if count < 3:
            state, action = "insufficient_evidence", "collect_more_evidence"
        elif pct < 50:
            state, action = "needs_practice", "practice_foundations"
        elif pct < 80:
            state, action = "developing", "targeted_review"
        else:
            state, action = "demonstrated", "optional_enrichment"
        results.append({"code": code, "state": state, "suggestedAction": action})
    return _private(JsonResponse({
        "version": 1,
        "insights": results,
        "reviewRequired": True,
        "verifiedAssessment": False,
        "disclaimer": "Advisory draft from supplied metrics; educator review required.",
    }))
