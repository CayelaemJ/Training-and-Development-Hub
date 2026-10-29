"""Request-host validation, including endpoints which never call get_host()."""


class StrictHostValidationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # request.get_host validates against settings.ALLOWED_HOSTS and raises
        # DisallowedHost for any arbitrary Host header (Django returns HTTP 400).
        request.get_host()
        return self.get_response(request)
