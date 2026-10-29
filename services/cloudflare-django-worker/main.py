"""Cloudflare Python Worker entrypoint for CABO's isolated Django insights API."""
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cabo_worker.settings")

from django.core.wsgi import get_wsgi_application
from workers import wsgi

application = get_wsgi_application()
Default = wsgi.entrypoint(application)
