"""
💎 Product Download API
========================
Delivers purchased products to customers with valid license keys.
"""

import logging
import os
from pathlib import Path
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/products", tags=["Products"])

# Product catalog with file paths
PRODUCTS = {
    "agencyos-enterprise": "products/paid/agencyos-enterprise-v1.0.0.zip",
    "auth-starter": "products/paid/auth-starter-supabase-v20260124.zip",
    "landing-page-kit": "products/paid/landing-page-kit-v20260124.zip",
    "admin-dashboard": "products/paid/admin-dashboard-pro-v1.0.0.zip",
    "ai-skills-pack": "products/paid/ai-skills-pack-v1.0.0.zip",
    "api-boilerplate": "products/paid/api-boilerplate-fastapi-v1.0.0.zip",
    "vietnamese-agency-kit": "products/paid/vietnamese-agency-kit-v1.0.0.zip",
    "payment-scripts": "products/paid/payment-scripts-v20260118.zip",
}


@router.get("/catalog")
async def list_products() -> List[Dict]:
    """
    List all available products.
    """
    return [
        {
            "id": "agencyos-enterprise",
            "name": "AgencyOS Enterprise Edition",
            "price": 395.0,
            "description": "Complete agency management system",
        },
        {
            "id": "auth-starter",
            "name": "Auth Starter Kit (Supabase)",
            "price": 49.0,
            "description": "Authentication boilerplate with Supabase",
        },
        {
            "id": "landing-page-kit",
            "name": "Landing Page Kit",
            "price": 29.0,
            "description": "Marketing landing page templates",
        },
        {
            "id": "admin-dashboard",
            "name": "Admin Dashboard Pro",
            "price": 79.0,
            "description": "Professional admin dashboard",
        },
        {
            "id": "ai-skills-pack",
            "name": "AI Skills Pack",
            "price": 99.0,
            "description": "Collection of AI automation skills",
        },
        {
            "id": "api-boilerplate",
            "name": "FastAPI Boilerplate",
            "price": 49.0,
            "description": "Production-ready API template",
        },
        {
            "id": "vietnamese-agency-kit",
            "name": "Vietnamese Agency Kit",
            "price": 149.0,
            "description": "Localized agency toolkit for Vietnam",
        },
        {
            "id": "payment-scripts",
            "name": "Payment Integration Scripts",
            "price": 39.0,
            "description": "PayPal + Stripe integration scripts",
        },
    ]


@router.get("/download/{product_id}")
async def download_product(
    product_id: str,
    license_key: str = Header(..., description="License key from purchase"),
):
    """
    Download purchased product with valid license.

    **Headers Required:**
    - `license-key`: Your purchase license key

    **Response:** ZIP file download
    """
    # Validate product exists
    if product_id not in PRODUCTS:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")

    # TODO: Verify license key against database (skipped for MVP)
    # For now, just check if license key is provided and not empty
    if not license_key or len(license_key) < 10:
        raise HTTPException(status_code=401, detail="Invalid license key")

    # Get product file path
    product_path = PRODUCTS[product_id]
    full_path = Path(product_path)

    if not full_path.exists():
        logger.error(f"Product file missing: {full_path}")
        raise HTTPException(status_code=500, detail="Product file not found on server")

    # Log download
    logger.info(f"📦 Product download: {product_id} | License: {license_key[:8]}...")

    # Return file
    return FileResponse(
        path=str(full_path),
        media_type="application/zip",
        filename=full_path.name,
    )


@router.get("/verify-license")
async def verify_license(license_key: str = Header(...)):
    """
    Verify license key validity and show entitled products.

    **Headers Required:**
    - `license-key`: Your purchase license key
    """
    # TODO: Query database for license
    # For MVP, just acknowledge the key
    if not license_key or len(license_key) < 10:
        raise HTTPException(status_code=401, detail="Invalid license key")

    # Mock response - in production, this would query Supabase
    return {
        "valid": True,
        "license_key": license_key,
        "entitled_products": [
            "agencyos-enterprise"
        ],  # In production, query from DB based on purchase
        "status": "active",
        "message": "License verified successfully",
    }
