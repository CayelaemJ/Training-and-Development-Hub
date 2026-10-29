"""Cloudflare Django worker settings.

No ORM, learner database or session state at the edge. The main CABO API
remains authoritative for identity, permissions, consent and school data.
"""
import os

try:
    from workers import env
except ImportError:
    # Only for local Django tests. The Cloudflare runtime must supply bindings.
    SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "test-runtime-only-not-for-deployment")
    ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]
else:
    # Missing Worker bindings abort startup rather than opening an insecure mode.
    SECRET_KEY = str(env.DJANGO_SECRET_KEY)
    ALLOWED_HOSTS = [str(env.DJANGO_ALLOWED_HOST)]

DEBUG = False
ROOT_URLCONF = "cabo_worker.urls"
INSTALLED_APPS = []
MIDDLEWARE = ["django.middleware.security.SecurityMiddleware"]
USE_TZ = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
DATA_UPLOAD_MAX_MEMORY_SIZE = 4096
# No DATABASES: Django must never independently modify learner records.
