"""Password hashing on the standard library only.

PBKDF2-HMAC-SHA256 from hashlib: no passlib, no bcrypt wheel, nothing new in
requirements.txt or the Docker image. Stored as an algorithm-tagged string so the
cost can be raised later without invalidating existing hashes.
"""
from __future__ import annotations

import hashlib
import secrets

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 200_000
MIN_LENGTH = 8


def hash_password(password: str, *, iterations: int = ITERATIONS) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations)
    return f"{ALGORITHM}${iterations}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored.split("$", 3)
    except ValueError:
        return False
    if algorithm != ALGORITHM:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations))
    return secrets.compare_digest(digest.hex(), expected)
