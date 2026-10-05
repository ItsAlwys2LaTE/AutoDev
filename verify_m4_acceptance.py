"""
AutoDev React Migration Phase 0 - Milestone 4 Programmatic Verification Script
Verifies:
1. Production React bundle serving via GET /
2. Fallback serving to legacy backend/index.html when backend/dist is moved
3. Restored React bundle serving when backend/dist is restored
4. Exact byte length and SHA256 checksum of legacy backend/index.html
5. Asset serving verification for JS and CSS files
"""

import sys
import shutil
import hashlib
from pathlib import Path
from starlette.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = REPO_ROOT / "backend"
DIST_DIR = BACKEND_DIR / "dist"
DIST_INDEX_HTML = DIST_DIR / "index.html"
LEGACY_INDEX_HTML = BACKEND_DIR / "index.html"

# Ensure backend directory is in sys.path
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main

EXPECTED_LEGACY_SIZE = 319883
EXPECTED_LEGACY_SHA256 = "AF5B146A30DC66A808491BBC0450A80F96B6CD60EFB31705466684C189202707"

def safe_restore(backup_path: Path, target_path: Path):
    if backup_path.exists():
        if target_path.exists():
            if target_path.is_dir():
                shutil.rmtree(str(target_path))
            else:
                target_path.unlink()
        shutil.move(str(backup_path), str(target_path))

def main_verify():
    print("=" * 70)
    print("Starting Milestone 4 Programmatic Backend Serving & Fallback Verification")
    print("=" * 70)

    client = TestClient(main.app)

    # Check 1: Production bundle serving
    print("\n[Step 1] Verifying GET / serves backend/dist/index.html (React Vite app)...")
    assert DIST_DIR.is_dir(), f"backend/dist not found at {DIST_DIR}"
    assert DIST_INDEX_HTML.is_file(), f"backend/dist/index.html not found at {DIST_INDEX_HTML}"

    resp = client.get("/")
    assert resp.status_code == 200, f"Expected status 200, got {resp.status_code}"
    assert "text/html" in resp.headers.get("content-type", "")
    assert '<div id="root"></div>' in resp.text, "React root container '<div id=\"root\"></div>' not found"
    assert "/assets/index-" in resp.text, "Vite asset bundle reference not found in dist/index.html"
    assert "AutoDev Orchestrator" not in resp.text, "Legacy title unexpectedly found in dist/index.html"
    print("[PASS] Step 1 PASSED: GET / cleanly serves backend/dist/index.html with React placeholder markup.")

    # Check 1b: Static asset serving
    print("\n[Step 1b] Verifying static assets are served properly from /assets...")
    assets_dir = DIST_DIR / "assets"
    asset_files = list(assets_dir.glob("*"))
    assert len(asset_files) > 0, "No assets found in backend/dist/assets"
    for af in asset_files:
        asset_resp = client.get(f"/assets/{af.name}")
        assert asset_resp.status_code == 200, f"Failed to retrieve asset {af.name}"
        assert len(asset_resp.content) == af.stat().st_size
        print(f"  [PASS] Served asset: {af.name} ({len(asset_resp.content)} bytes, {asset_resp.headers.get('content-type')})")
    print("[PASS] Step 1b PASSED: All compiled assets served with HTTP 200.")

    # Check 2: Fallback when backend/dist is moved
    print("\n[Step 2] Temporarily moving backend/dist to verify dynamic fallback...")
    temp_backup = BACKEND_DIR / "dist_m4_temp_backup"
    safe_restore(temp_backup, DIST_DIR)  # clean up any stale backup
    shutil.move(str(DIST_DIR), str(temp_backup))
    try:
        assert not DIST_DIR.exists(), "backend/dist still exists after move"
        fallback_resp = client.get("/")
        assert fallback_resp.status_code == 200, f"Fallback expected 200, got {fallback_resp.status_code}"
        assert "text/html" in fallback_resp.headers.get("content-type", "")
        assert "AutoDev Orchestrator" in fallback_resp.text, "Legacy title 'AutoDev Orchestrator' missing in fallback"
        assert '<div id="root"></div>' not in fallback_resp.text, "React root unexpectedly present during fallback"
        assert len(fallback_resp.content) == EXPECTED_LEGACY_SIZE, f"Fallback content byte length mismatch: {len(fallback_resp.content)} vs {EXPECTED_LEGACY_SIZE}"
        print(f"[PASS] Step 2 PASSED: GET / automatically fell back to backend/index.html ({len(fallback_resp.content)} bytes).")
    finally:
        # Check 3: Restoration
        print("\n[Step 3] Restoring backend/dist and verifying React bundle serving restored...")
        safe_restore(temp_backup, DIST_DIR)

    assert DIST_DIR.is_dir(), "backend/dist was not restored"
    restored_resp = client.get("/")
    assert restored_resp.status_code == 200, f"Expected 200 after restore, got {restored_resp.status_code}"
    assert '<div id="root"></div>' in restored_resp.text, "React root missing after restoration"
    assert "AutoDev Orchestrator" not in restored_resp.text, "Legacy content unexpectedly present after restore"
    print("[PASS] Step 3 PASSED: GET / successfully restored serving backend/dist/index.html.")

    # Check 4: Integrity check on legacy index.html
    print("\n[Step 4] Verifying byte-exact integrity and SHA256 of backend/index.html...")
    assert LEGACY_INDEX_HTML.is_file(), f"Legacy index.html missing at {LEGACY_INDEX_HTML}"
    legacy_bytes = LEGACY_INDEX_HTML.read_bytes()
    legacy_size = len(legacy_bytes)
    legacy_sha256 = hashlib.sha256(legacy_bytes).hexdigest().upper()

    print(f"  Observed size  : {legacy_size} bytes (Expected: {EXPECTED_LEGACY_SIZE})")
    print(f"  Observed SHA256: {legacy_sha256}")
    print(f"  Expected SHA256: {EXPECTED_LEGACY_SHA256}")

    assert legacy_size == EXPECTED_LEGACY_SIZE, f"Size mismatch: {legacy_size} != {EXPECTED_LEGACY_SIZE}"
    assert legacy_sha256 == EXPECTED_LEGACY_SHA256, f"SHA256 mismatch: {legacy_sha256} != {EXPECTED_LEGACY_SHA256}"
    print("[PASS] Step 4 PASSED: backend/index.html is 100% byte-identical and cryptographically untouched.")

    print("\n" + "=" * 70)
    print("ALL MILESTONE 4 PROGRAMMATIC VERIFICATION CHECKS PASSED (100%)")
    print("=" * 70)

if __name__ == "__main__":
    main_verify()
