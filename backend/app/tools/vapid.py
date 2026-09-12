"""Generate a VAPID keypair for Web Push. Run: python -m app.tools.vapid"""
from __future__ import annotations

import base64

try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
except ImportError:  # pragma: no cover
    raise SystemExit("pip install cryptography")


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def main() -> None:
    key = ec.generate_private_key(ec.SECP256R1())
    priv = key.private_numbers().private_value.to_bytes(32, "big")
    pub = key.public_key().public_bytes(serialization.Encoding.X962,
                                        serialization.PublicFormat.UncompressedPoint)
    print("VAPID_PRIVATE_KEY=" + b64(priv))
    print("VAPID_PUBLIC_KEY=" + b64(pub))


if __name__ == "__main__":
    main()
