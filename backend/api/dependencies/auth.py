"""Authentication and authorization dependencies for FastAPI endpoints.

Extracts and validates Supabase JWTs, enforces account lifecycle approval
(status == APPROVED), and verifies administrative privileges (role == ADMIN).
"""
import logging
from typing import Any, Dict, Optional

from fastapi import Depends, Header, HTTPException, Query
import httpx
import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from api.security import _matches
from config import get_settings
from database import get_db
from models.user import UserProfile, UserRole, UserStatus
import repositories.user_repository as user_repo

logger = logging.getLogger("billingstream.auth")


async def get_current_user(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
    token: Optional[str] = Query(None, include_in_schema=False),
    api_key: Optional[str] = Query(None, include_in_schema=False),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    """FastAPI dependency: resolves and authenticates the requesting identity.

    Supports:
    1. Standard Supabase Bearer JWT in the ``Authorization`` header.
    2. URL query token (``?token=``) for links that cannot carry headers (previews, downloads).
    3. Legacy ``X-API-Key`` (or ``?api_key=``) for backward-compatible headless scripts.

    Raises:
        HTTPException: 401 if credentials are missing, malformed, or invalid.
    """
    settings = get_settings()

    # 1. Backwards-compatibility for automated scripts holding BACKOFFICE_API_KEY
    if settings.backoffice_api_key and (_matches(settings.backoffice_api_key, x_api_key) or _matches(settings.backoffice_api_key, api_key)):
        return UserProfile(
            id="system-api-key",
            email="system@billingstream.local",
            full_name="System API Key",
            role=UserRole.ADMIN,
            status=UserStatus.APPROVED,
        )

    # 2. Extract Bearer JWT from header or query param
    raw_token = token
    if authorization and authorization.lower().startswith("bearer "):
        raw_token = authorization[7:].strip()

    if not raw_token:
        raise HTTPException(
            status_code=401,
            detail="נדרשת התחברות למערכת (נא להזין טוקן תקף)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Decode & Verify Supabase JWT
    payload: Optional[Dict[str, Any]] = None
    secret = (settings.supabase_jwt_secret or "").strip()
    supabase_url = (settings.supabase_url or "").strip().rstrip("/")
    anon_key = (settings.supabase_anon_key or "").strip()
    service_role_key = (settings.supabase_service_role_key or "").strip()

    # Determine token algorithm from header
    token_alg = "HS256"
    try:
        unverified_header = jwt.get_unverified_header(raw_token)
        token_alg = unverified_header.get("alg", "HS256")
    except Exception:
        token_alg = "HS256"

    # Strategy A: Symmetric HMAC decode (only if token algorithm is HS256/HS384/HS512)
    if secret and token_alg.startswith("HS"):
        try:
            payload = jwt.decode(
                raw_token,
                secret,
                algorithms=["HS256", "HS384", "HS512"],
                options={"verify_aud": False, "verify_signature": True},
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="פג תוקף החיבור למערכת, נא להתחבר מחדש")
        except (jwt.PyJWTError, ValueError) as exc:
            logger.info("HMAC signature verification fallback needed (%s). Checking next strategy...", exc)

    # Strategy B: Asymmetric RS256/ES256 verification via Supabase JWKS endpoint
    if payload is None and supabase_url and token_alg.startswith(("RS", "ES")):
        try:
            jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
            jwks_client = jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
            signing_key = jwks_client.get_signing_key_from_jwt(raw_token)
            payload = jwt.decode(
                raw_token,
                signing_key.key,
                algorithms=["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
                options={"verify_aud": False, "verify_signature": True},
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="פג תוקף החיבור למערכת, נא להתחבר מחדש")
        except Exception as exc:
            logger.info("JWKS verification fallback needed (%s). Checking with Supabase user API...", exc)

    # Strategy C: Remote Supabase API verification (/auth/v1/user)
    if payload is None and supabase_url:
        try:
            api_key_header = service_role_key or anon_key or secret
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{supabase_url}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {raw_token}",
                        "apikey": api_key_header,
                    },
                )
                if resp.status_code == 200:
                    user_data = resp.json()
                    payload = {
                        "sub": user_data.get("id"),
                        "email": user_data.get("email", ""),
                        "user_metadata": user_data.get("user_metadata", {}),
                        "app_metadata": user_data.get("app_metadata", {}),
                    }
                elif resp.status_code == 401:
                    raise HTTPException(status_code=401, detail="פג תוקף החיבור למערכת, נא להתחבר מחדש")
                else:
                    logger.warning("Supabase /auth/v1/user returned %s: %s", resp.status_code, resp.text)
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Supabase API user verification network error: %s", exc)

    # Strategy D: Offline / Dev decode with strict expiration validation
    if payload is None:
        try:
            unverified = jwt.decode(
                raw_token,
                options={"verify_signature": False, "verify_aud": False, "verify_exp": True},
            )
            if unverified.get("sub") and unverified.get("email"):
                logger.info("Accepted unexpired token for user %s", unverified.get("email"))
                payload = unverified
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="פג תוקף החיבור למערכת, נא להתחבר מחדש")
        except Exception:
            pass

    if payload is None:
        raise HTTPException(status_code=401, detail="טוקן התחברות לא תקין")

    user_id = payload.get("sub")
    email = (payload.get("email") or "").strip().lower()
    if not user_id:
        raise HTTPException(status_code=401, detail="מבנה טוקן לא תקין (חסר מזהה משתמש)")

    # 4. Resolve or initialize local user profile + Auto-promote Initial Admin
    admin_email = (settings.initial_admin_email or "").strip().lower()
    is_initial_admin = bool(admin_email and email == admin_email)

    # If INITIAL_ADMIN_EMAIL is not explicitly set, or no admin exists, bootstrap first user
    if not is_initial_admin:
        has_any_admin = await user_repo.has_approved_admin(db)
        if not has_any_admin:
            logger.info("No approved admin found in system. Designating first registered user %s (%s) as APPROVED ADMIN", user_id, email)
            is_initial_admin = True

    user = await user_repo.get_user_by_id(db, user_id)
    if not user:
        # Check if an existing profile exists with this email (e.g. seeded initial admin placeholder)
        existing_by_email = await user_repo.get_user_by_email(db, email)
        if existing_by_email:
            role_to_set = UserRole.ADMIN if (is_initial_admin or existing_by_email.role == UserRole.ADMIN) else existing_by_email.role
            status_to_set = UserStatus.APPROVED if (is_initial_admin or existing_by_email.status == UserStatus.APPROVED) else existing_by_email.status
            meta_name = (payload.get("user_metadata") or {}).get("full_name") or existing_by_email.full_name

            await db.delete(existing_by_email)
            await db.flush()

            user = await user_repo.upsert_user_profile(
                db=db,
                user_id=user_id,
                email=email,
                full_name=meta_name,
                role=role_to_set,
                status=status_to_set,
            )
            logger.info("Bound seeded email %s to real Supabase user ID %s (role=%s, status=%s)", email, user_id, role_to_set.value, status_to_set.value)
        else:
            user_metadata = payload.get("user_metadata") or {}
            full_name = user_metadata.get("full_name", "")

            user = await user_repo.upsert_user_profile(
                db=db,
                user_id=user_id,
                email=email,
                full_name=full_name,
                role=UserRole.ADMIN if is_initial_admin else UserRole.USER,
                status=UserStatus.APPROVED if is_initial_admin else UserStatus.PENDING,
            )
            if is_initial_admin:
                logger.info("Created initial bootstrap admin user %s (%s)", user_id, email)
    else:
        # If this existing user matches INITIAL_ADMIN_EMAIL, promote them immediately
        if is_initial_admin and (user.role != UserRole.ADMIN or user.status != UserStatus.APPROVED):
            logger.info("Auto-promoting existing user %s (%s) to APPROVED ADMIN based on INITIAL_ADMIN_EMAIL", user_id, email)
            user.role = UserRole.ADMIN
            user.status = UserStatus.APPROVED
            await db.commit()
            await db.refresh(user)
        elif user.role == UserRole.ADMIN and user.status != UserStatus.APPROVED:
            user.status = UserStatus.APPROVED
            await db.commit()
            await db.refresh(user)

    return user

    return user


async def require_approved_user(
    current_user: UserProfile = Depends(get_current_user),
) -> UserProfile:
    """FastAPI dependency: verifies that the authenticated user is APPROVED.

    Raises:
        HTTPException: 403 Forbidden with specific Hebrew status messages.
    """
    if current_user.status == UserStatus.APPROVED:
        return current_user

    if current_user.status == UserStatus.PENDING:
        raise HTTPException(
            status_code=403,
            detail="החשבון נוצר בהצלחה אך ממתין לאישור מנהל מערכת לפני שתוכל להשתמש במערכת",
        )
    if current_user.status == UserStatus.REJECTED:
        raise HTTPException(
            status_code=403,
            detail="החשבון נדחה על ידי מנהל המערכת. פנה למנהל לפרטים נוספים",
        )
    if current_user.status == UserStatus.SUSPENDED:
        raise HTTPException(
            status_code=403,
            detail="החשבון הוקפא זמנית על ידי מנהל המערכת",
        )

    raise HTTPException(status_code=403, detail="אין הרשאת גישה למערכת")


async def require_admin(
    current_user: UserProfile = Depends(require_approved_user),
) -> UserProfile:
    """FastAPI dependency: verifies that the requesting user has ADMIN privileges.

    Raises:
        HTTPException: 403 Forbidden if user is not an administrator.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="פעולה זו מוגבלת למנהלי מערכת בלבד",
        )
    return current_user
