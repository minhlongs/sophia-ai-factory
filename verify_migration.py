import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

print("🔍 Verifying Phase 4 Migration...")

try:
    print("👉 Importing api.config...")
    from api.config import get_settings
    settings = get_settings()
    print(f"   ✅ Config loaded: {settings.APP_NAME} v{settings.VERSION}")

    print("👉 Importing api.db...")
    from api.db import get_db
    # Don't connect, just import
    print("   ✅ DB module imported")

    print("👉 Importing api.services.payment_service...")
    from api.services.payment_service import PaymentService
    service = PaymentService()
    print("   ✅ PaymentService initialized")

    print("👉 Importing api.routers.payments...")
    from api.routers import payments
    print("   ✅ Payments router imported")

    print("👉 Importing api.main...")
    from api.main import app
    print("   ✅ Main app imported")

    print("\n🎉 PHASE 4 VERIFICATION SUCCESSFUL: All dependencies resolved.")

except ImportError as e:
    print(f"\n❌ IMPORT ERROR: {e}")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ RUNTIME ERROR: {e}")
    sys.exit(1)
