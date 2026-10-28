import json
import os
from django.test import SimpleTestCase, override_settings
from django.test.client import Client

TOKEN = "long-test-only-token"
URL = "/v1/insights/draft"

class InsightsDraftTests(SimpleTestCase):
    def setUp(self):
        self.old = os.environ.get("DJANGO_WORKER_TOKEN")
        os.environ["DJANGO_WORKER_TOKEN"] = TOKEN
        self.client = Client()

    def tearDown(self):
        if self.old is None:
            os.environ.pop("DJANGO_WORKER_TOKEN", None)
        else:
            os.environ["DJANGO_WORKER_TOKEN"] = self.old

    def post(self, data, auth=True):
        return self.client.post(
            URL,
            data=json.dumps(data),
            content_type="application/json",
            **({"HTTP_AUTHORIZATION": "Bearer " + TOKEN} if auth else {}),
        )

    def test_missing_auth_is_rejected(self):
        self.assertEqual(self.post({"concepts": []}, auth=False).status_code, 401)

    def test_drafts_are_advisory_not_grades(self):
        r = self.post({"concepts": [
            {"code": "fractions", "masteryPercent": 45, "evidenceCount": 5},
            {"code": "algebra", "masteryPercent": 90, "evidenceCount": 1},
        ]})
        self.assertEqual(r.status_code, 200)
        result = r.json()
        self.assertTrue(result["reviewRequired"])
        self.assertFalse(result["verifiedAssessment"])
        self.assertEqual(result["insights"][0]["state"], "needs_practice")
        self.assertEqual(result["insights"][1]["state"], "insufficient_evidence")
        self.assertEqual(r["Cache-Control"], "no-store")

    def test_rejects_personal_text_fields(self):
        r = self.post({"concepts": [
            {"code": "fractions", "masteryPercent": 50, "evidenceCount": 5, "studentName": "Test"},
        ]})
        self.assertEqual(r.status_code, 400)

    def test_rejects_duplicate_concepts_and_bool_metrics(self):
        repeated = {"code": "fractions", "masteryPercent": 50, "evidenceCount": 4}
        self.assertEqual(self.post({"concepts": [repeated, repeated]}).status_code, 400)
        self.assertEqual(self.post({"concepts": [
            {"code": "fractions", "masteryPercent": True, "evidenceCount": 4}
        ]}).status_code, 400)
