from django.urls import path
from .views import health, insights_draft

urlpatterns = [
    path("health", health),
    path("v1/insights/draft", insights_draft),
]
