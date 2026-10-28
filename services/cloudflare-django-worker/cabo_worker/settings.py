"""No ORM, learner database or session state at the edge.

The existing CABO API remains the source of truth for records and permissions.
"""
import os

try:
    from workers import env
except ImportError:
    SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "local-only-not-a-production-secret")
else:
    # Required in Cloudflare; never silently use a fallback in production.
    SECRET_KEY = str(env.DJANGO_SECRET_KEY)

DEBUG = False
ROOT_URLCONF = "cabo_worker.urls"
ALLOWED_HOSTS = ["*"]  # Cloudflare routing host varies; bearer auth is mandatory.
INSTALLED_APPS = []
MIDDLEWARE = ["django.middleware.security.SecurityMiddleware"]
USE_TZ = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
# No DATABASES: Django must never own or independently modify learner records.
