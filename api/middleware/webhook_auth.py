"""
🔐 Webhook Signature Verification Middleware
=============================================
Security-critical middleware for verifying webhook authenticity from payment providers.

Features:
- HMAC-SHA256 signature verification for Gumroad webhooks
- Stripe webhook signature verification using Stripe SDK
- Comprehensive logging of all verification attempts
- Reject invalid signatures with 401 Unauthorized
- Support for timestamp validation to prevent replay attacks
"""

import hashlib
import hmac
import logging
import os
import time
from typing import Optional

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

# Security constants
MAX_TIMESTAMP_AGE = 300  # 5 minutes - prevent replay attacks
STRIPE_TOLERANCE = 300  # Stripe default tolerance (5 minutes)


class WebhookAuthError(HTTPException):
    """Custom exception for webhook authentication failures."""

    def __init__(self, detail: str, provider: str = "unknown"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)
        self.provider = provider
        logger.error(f"🚫 Webhook Auth Failed [{provider}]: {detail}")


def verify_gumroad_signature(payload: bytes, signature_header: Optional[str], secret: str) -> bool:
    """
    Verify Gumroad webhook signature using HMAC-SHA256.
    """
    if not signature_header:
        logger.warning("⚠️ Gumroad webhook missing signature header")
        raise WebhookAuthError(detail="Missing X-Gumroad-Signature header", provider="gumroad")

    if not secret:
        logger.error("❌ GUMROAD_WEBHOOK_SECRET not configured")
        raise WebhookAuthError(detail="Webhook secret not configured", provider="gumroad")

    try:
        # Compute expected signature
        expected_signature = hmac.new(
            key=secret.encode("utf-8"), msg=payload, digestmod=hashlib.sha256
        ).hexdigest()

        # Compare signatures using constant-time comparison
        is_valid = hmac.compare_digest(expected_signature, signature_header.strip())

        if is_valid:
            logger.info("✅ Gumroad webhook signature verified")
            return True
        else:
            logger.warning(
                f"⚠️ Gumroad signature mismatch\n"
                f"  Expected: {expected_signature[:16]}...\n"
                f"  Received: {signature_header[:16]}..."
            )
            raise WebhookAuthError(detail="Invalid webhook signature", provider="gumroad")

    except Exception as e:
        logger.error(f"❌ Gumroad signature verification error: {e}")
        raise WebhookAuthError(
            detail=f"Signature verification failed: {str(e)}", provider="gumroad"
        )


def verify_stripe_signature(
    payload: bytes, signature_header: Optional[str], secret: str, tolerance: int = STRIPE_TOLERANCE
) -> dict:
    """
    Verify Stripe webhook signature.
    """
    if not signature_header:
        logger.warning("⚠️ Stripe webhook missing signature header")
        raise WebhookAuthError(detail="Missing Stripe-Signature header", provider="stripe")

    if not secret:
        logger.error("❌ STRIPE_WEBHOOK_SECRET not configured")
        raise WebhookAuthError(detail="Webhook secret not configured", provider="stripe")

    try:
        # Use Stripe SDK for verification (more robust)
        import stripe

        event = stripe.Webhook.construct_event(
            payload=payload, sig_header=signature_header, secret=secret, tolerance=tolerance
        )

        logger.info(f"✅ Stripe webhook signature verified: {event.get('type')}")
        return event

    except stripe.error.SignatureVerificationError as e:
        logger.warning(f"⚠️ Stripe signature verification failed: {e}")
        raise WebhookAuthError(detail="Invalid webhook signature", provider="stripe")
    except ValueError as e:
        logger.error(f"❌ Stripe webhook payload error: {e}")
        raise WebhookAuthError(detail=f"Invalid webhook payload: {str(e)}", provider="stripe")
    except Exception as e:
        logger.error(f"❌ Stripe signature verification error: {e}")
        raise WebhookAuthError(detail=f"Signature verification failed: {str(e)}", provider="stripe")


def verify_timestamp(timestamp: int, max_age: int = MAX_TIMESTAMP_AGE) -> bool:
    """
    Verify webhook timestamp is recent to prevent replay attacks.
    """
    current_time = int(time.time())
    age = current_time - timestamp

    if age > max_age:
        logger.warning(f"⚠️ Webhook timestamp too old: {age}s (max {max_age}s)")
        return False

    if age < -60:  # Allow 1 minute clock skew
        logger.warning(f"⚠️ Webhook timestamp in future: {age}s")
        return False

    return True


async def verify_gumroad_webhook(request: Request) -> bytes:
    """
    FastAPI dependency for verifying Gumroad webhooks.
    """
    signature = request.headers.get("X-Gumroad-Signature")
    body = await request.body()
    secret = os.getenv("GUMROAD_WEBHOOK_SECRET")

    logger.info("🔍 Verifying Gumroad webhook signature")

    try:
        verify_gumroad_signature(body, signature, secret)
        return body
    except WebhookAuthError:
        raise


async def verify_stripe_webhook(request: Request) -> dict:
    """
    FastAPI dependency for verifying Stripe webhooks.
    """
    signature = request.headers.get("Stripe-Signature")
    body = await request.body()
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    logger.info("🔍 Verifying Stripe webhook signature")

    try:
        event = verify_stripe_signature(body, signature, secret)
        return event
    except WebhookAuthError:
        raise
