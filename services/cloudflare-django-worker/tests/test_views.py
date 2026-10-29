"""Contract/security tests for the isolated Cloudflare Django Worker."""
import json
import os
from django.test import SimpleTestCase, Client

TOKEN = "long-test-only-token-for-ci-tests-1234"
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
            URL, data=json.dumps(data), content_type="application/json",
            **({"HTTP_AUTHORIZATION": "Bearer " + TOKEN} if auth else {}),
        )

    def test_health_is_public_but_exposes_no_secrets(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertNotIn("token", response.content.decode().lower())

    def test_unauthenticated_requests_are_rejected(self):
        self.assertEqual(self.post({"concepts": []}, auth=False).status_code, 401)
        response = self.client.post(
            URL, data="{}", content_type="application/json",
            HTTP_AUTHORIZATION="Bearer wrong-token",
        )
        self.assertEqual(response.status_code, 401)

    def test_missing_secret_fails_closed(self):
        del os.environ["DJANGO_WORKER_TOKEN"]
        self.assertEqual(self.post({"concepts": []}).status_code, 401)

    def test_drafts_are_advisory_not_grades(self):
        result = self.post({"concepts": [
            {"code": "fractions", "masteryPercent": 45, "evidenceCount": 5},
            {"code": "algebra", "masteryPercent": 90, "evidenceCount": 1},
        ]})
        self.assertEqual(result.status_code, 200)
        body = result.json()
        self.assertTrue(body["reviewRequired"])
        self.assertFalse(body["verifiedAssessment"])
        self.assertEqual(body["insights"][0]["state"], "needs_practice")
        self.assertEqual(body["insights"][1]["state"], "insufficient_evidence")
        self.assertEqual(result["Cache-Control"], "no-store")

    def test_invalid_personal_fields_rejected(self):
        self.assertEqual(self.post({"concepts": [
            {"code": "fractions", "masteryPercent": 50, "evidenceCount": 5,
             "studentName": "Test Person"},
        ]}).status_code, 400)
        self.assertEqual(self.post({"concepts": [], "learnerId": 1}).status_code, 400)

    def test_invalid_metrics_rejected(self):
        item = {"code": "fractions", "masteryPercent": 50, "evidenceCount": 4}
        self.assertEqual(self.post({"concepts": [item, item]}).status_code, 400)
        self.assertEqual(self.post({"concepts": [{**item, "masteryPercent": True}]}).status_code, 400)
        self.assertEqual(self.post({"concepts": [{**item, "masteryPercent": -1}]}).status_code, 400)
        self.assertEqual(self.post({"concepts": [{**item, "code": "John Doe"}]}).status_code, 400)

    def test_post_only_and_content_type(self):
        self.assertEqual(self.client.get(URL).status_code, 405)
        self.assertEqual(self.client.post(URL, data="{}", content_type="text/plain",
            HTTP_AUTHORIZATION="Bearer " + TOKEN).status_code, 400)

    def test_oversize_json_rejected(self):
        # The front-door limit is independent of the JSON decoder.
        payload = json.dumps({"concepts": [], "padding": "x" * 4097})
        response = self.client.post(
            URL, data=payload, content_type="application/json",
            HTTP_AUTHORIZATION="Bearer " + TOKEN,
        )
        self.assertEqual(response.status_code, 400)

    def test_host_header_restricted(self):
        result = self.client.get("/health", HTTP_HOST="forged.attacker.invalid")
        self.assertEqual(result.status_code, 400)
