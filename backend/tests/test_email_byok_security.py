"""Security and architectural tests for Sandbox Email Simulation vs Production Inbound Email.

Validates that:
1. The Sandbox simulation endpoint strictly binds to BYOKCredentials.
2. When no BYOK key is supplied, simulation strictly uses MockProvider (zero server quota consumed).
3. When a user BYOK key is supplied, simulation uses the scoped user key.
4. Clean Separation of Concerns:
   - email_simulation.py strictly handles Sandbox simulation, requires BYOKCredentials,
     and never relies on INBOUND_EMAIL_TOKEN.
   - email.py strictly handles Production external webhooks, enforces require_inbound_access,
     and never uses BYOKCredentials (always consuming the server key).
5. Ingestion pipeline contract guarantees that ingest_email accepts an optional scoped
   DocumentExtractor, defaulting to None (which falls back to the Server API Key).
"""
import inspect
import sys
from unittest.mock import MagicMock, patch
import pytest

# Mock openpyxl if not installed in the current environment
if "openpyxl" not in sys.modules:
    sys.modules["openpyxl"] = MagicMock()
    sys.modules["openpyxl.styles"] = MagicMock()
    sys.modules["openpyxl.utils"] = MagicMock()
    sys.modules["openpyxl.utils.exceptions"] = MagicMock()

from api.dependencies.byok import BYOKCredentials
from api.security import require_inbound_access
import api.routes.email as reality_module
import api.routes.email_simulation as simulation_module
from api.routes.email import router as reality_router
from api.routes.email_simulation import _process_simulation, router as simulation_router
from services.extraction.extractor import DocumentExtractor
from services.ingestion_pipeline import ingest_email


def test_simulation_without_byok_uses_mock_and_zero_server_quota():
    """Verifies that running a simulation without BYOK keys routes strictly to MockProvider."""
    # User provides NO personal keys
    byok = BYOKCredentials(gemini_api_key=None, openai_api_key=None)
    assert not byok.has_user_key

    extractor = byok.get_extractor()
    assert extractor.provider_names == ["mock"]

    # Verify that the server's key is never included in the scoped extractor
    assert "gemini" not in extractor.provider_names
    assert "openai" not in extractor.provider_names


@patch("services.extraction.extractor.GeminiProvider")
def test_simulation_with_byok_uses_user_key(mock_gemini_cls):
    """Verifies that providing a personal Gemini key uses that key for the simulation."""
    mock_instance = MagicMock()
    mock_instance.name = "gemini"
    mock_gemini_cls.return_value = mock_instance

    byok = BYOKCredentials(gemini_api_key="AIzaSyUserPersonalKey123")
    assert byok.has_user_key

    extractor = byok.get_extractor()
    assert extractor.provider_names == ["gemini"]
    mock_gemini_cls.assert_called_once()
    args, kwargs = mock_gemini_cls.call_args
    assert args[0] == "AIzaSyUserPersonalKey123"


def test_simulation_routes_separation_of_concerns():
    """Verifies that email_simulation.py owns sandbox simulation and strictly requires BYOK."""
    # Verify simulation route paths
    route_paths = [r.path for r in simulation_router.routes]
    assert "/simulate" in route_paths
    assert "/simulate/eml" in route_paths

    # Verify simulation module does NOT import or use production webhook auth
    assert not hasattr(simulation_module, "require_inbound_access")
    assert not hasattr(simulation_module, "INBOUND_EMAIL_TOKEN")

    # Verify simulation process helper strictly requires BYOKCredentials
    sig = inspect.signature(_process_simulation)
    assert "byok" in sig.parameters
    assert sig.parameters["byok"].annotation == BYOKCredentials


def test_production_routes_separation_of_concerns():
    """Verifies that email.py owns production reality, requiring secret token and zero BYOK."""
    # Verify production route paths
    route_paths = [r.path for r in reality_router.routes]
    assert "/inbound" in route_paths
    assert "/inbound/eml" in route_paths
    assert "/inbound/json" in route_paths

    # Verify reality router enforces require_inbound_access
    assert hasattr(reality_module, "require_inbound_access")
    dep_callables = [d.dependency for d in getattr(reality_router, "dependencies", [])]
    assert require_inbound_access in dep_callables, "Reality router missing require_inbound_access security dependency"

    # Verify production module does NOT import or reference BYOK credentials
    assert not hasattr(reality_module, "BYOKCredentials")
    assert not hasattr(reality_module, "get_byok_credentials")


def test_ingest_email_signature_contract():
    """Verifies ingest_email supports scoped extractor injection with default fallback to server key."""
    sig = inspect.signature(ingest_email)
    assert "extractor" in sig.parameters
    param = sig.parameters["extractor"]
    assert param.default is None, "Production fallback must default to None (server key)"


def test_main_mounts_both_simulation_and_reality_under_clean_namespaces():
    """Verifies that main.py registers both routers with clear separation."""
    from main import app

    routes = [r.path for r in app.routes]
    # Simulation endpoints
    assert "/api/email/simulate" in routes
    assert "/api/email/simulate/eml" in routes
    # Reality production endpoints
    assert "/api/email/inbound" in routes
    assert "/api/email/inbound/eml" in routes
    assert "/api/email/inbound/json" in routes
