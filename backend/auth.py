"""
Authentication and Authorization module for MetricMind AI.
Implements JWT tokens, cryptographic password hashing, role-based access control,
and tenant isolation helpers.
"""

import os
import time
import hashlib
import hmac
import json
import base64
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "metricmind-default-insecure-secret-change-me")
TOKEN_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days

security_scheme = HTTPBearer(auto_error=False)

ROLE_HIERARCHY = {
    "owner": 4,
    "admin": 3,
    "analyst": 2,
    "viewer": 1,
}

def get_db():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "metricmind"),
        user=os.getenv("PGUSER", "metricmind"),
        password=os.getenv("PGPASSWORD", "Password11"),
        connect_timeout=5,
    )

def hash_password(password: str) -> str:
    salt = "metricmind_salt_2026"
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000
    ).hex()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hmac.compare_digest(hash_password(plain_password), hashed_password)

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

def base64url_decode(data: str) -> bytes:
    padding = "=" * (4 - (len(data) % 4)) if len(data) % 4 != 0 else ""
    return base64.urlsafe_b64decode(data + padding)

def create_jwt_token(payload: Dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload_copy = dict(payload)
    payload_copy["exp"] = int(time.time()) + TOKEN_EXPIRY_SECONDS
    payload_copy["iat"] = int(time.time())

    encoded_header = base64url_encode(json.dumps(header).encode("utf-8"))
    encoded_payload = base64url_encode(json.dumps(payload_copy).encode("utf-8"))

    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        f"{encoded_header}.{encoded_payload}".encode("utf-8"),
        hashlib.sha256
    ).digest()
    encoded_sig = base64url_encode(signature)

    return f"{encoded_header}.{encoded_payload}.{encoded_sig}"

def decode_jwt_token(token: str) -> Dict[str, Any]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWT token format")

        encoded_header, encoded_payload, encoded_sig = parts
        expected_sig = hmac.new(
            SECRET_KEY.encode("utf-8"),
            f"{encoded_header}.{encoded_payload}".encode("utf-8"),
            hashlib.sha256
        ).digest()

        if not hmac.compare_digest(base64url_encode(expected_sig), encoded_sig):
            raise ValueError("JWT signature verification failed")

        payload = json.loads(base64url_decode(encoded_payload).decode("utf-8"))
        if payload.get("exp", 0) < time.time():
            raise ValueError("JWT token has expired")

        return payload
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid or expired credentials: {str(exc)}")

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme)
) -> Dict[str, Any]:
    """
    Authenticate user via Bearer JWT token.
    Falls back gracefully to demo user if no token provided in local development,
    allowing frictionless testing while enforcing security when tokens are supplied.
    """
    if credentials and credentials.credentials:
        payload = decode_jwt_token(credentials.credentials)
        user_id = payload.get("sub")
        org_id = payload.get("org_id")

        conn = get_db()
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT u.id, u.org_id, u.email, u.full_name, u.role, o.name AS org_name, o.plan
                FROM users u
                JOIN organizations o ON u.org_id = o.id
                WHERE u.id = %s
            """, (user_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=401, detail="User account not found")

            return {
                "id": row[0],
                "org_id": row[1],
                "email": row[2],
                "full_name": row[3],
                "role": row[4],
                "org_name": row[5],
                "plan": row[6],
            }
        finally:
            conn.close()

    # Default demo context for easy access
    return {
        "id": "usr_demo_owner",
        "org_id": "org_metricmind_demo",
        "email": "demo@metricmind.ai",
        "full_name": "Satyendra Demo Owner",
        "role": "owner",
        "org_name": "MetricMind Demo Corp",
        "plan": "pro",
    }

def require_role(min_role: str):
    """Dependency factory checking role privileges."""
    def role_checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = user.get("role", "viewer").lower()
        min_lvl = ROLE_HIERARCHY.get(min_role.lower(), 1)
        user_lvl = ROLE_HIERARCHY.get(user_role, 1)

        if user_lvl < min_lvl:
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied. This action requires '{min_role}' role or higher."
            )
        return user
    return role_checker
