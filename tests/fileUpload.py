import hashlib
import requests
import json
from datetime import datetime
from pathlib import Path
import time

# ============================================================================
# Configuration
# ============================================================================
BASE_URL = "http://localhost:8000/files"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAxOWM2MmQ3LWIxMGItNzY1ZS04ZDNhLWU1MmJmNjQ1MWNjOCIsImVtYWlsIjoiZG1lNTI0NUBnbWFpbC5jb20iLCJuYW1lIjoiZGVsbGFubyIsImlhdCI6MTc3MTQ0MDI1MSwiZXhwIjoxNzcxNDUxMDUxfQ.430nSYTk-Q2JIyldCjv1pNOjis11PSydsAotsYvsULs"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
}

# ============================================================================
# Helper Functions
# ============================================================================

def calculate_sha256(data: bytes) -> str:
    """Calculate SHA-256 hash of binary data"""
    return hashlib.sha256(data).hexdigest()


def create_test_file(filename: str, size_kb: int = 100) -> bytes:
    """Create a test file with random data"""
    return bytes(range(256)) * (size_kb * 1024 // 256)


# ============================================================================
# TEST 1: Upload Endpoint (/upload)
# ============================================================================

def test_upload():
    print("\n" + "="*70)
    print("TEST 1: POST /files/upload")
    print("="*70)
    
    # Create test file
    file_data = create_test_file("test_document.pdf", size_kb=50)
    checksum = calculate_sha256(file_data)
    creation_date = datetime.utcnow().isoformat() + "Z"
    
    print(f"📁 File size: {len(file_data)} bytes")
    print(f"🔐 SHA-256: {checksum[:16]}...")
    print(f"📅 Creation date: {creation_date}")
    
    # Prepare multipart form data
    files = {
        "file": ("test_document.pdf", file_data, "application/pdf")
    }
    
    data = {
        "creationDate": creation_date,
        "mimeType": "application/pdf",
        "originalName": "test_document.pdf"
    }
    
    headers = HEADERS.copy()
    headers["X-SHA256-Checksum"] = checksum
    
    # Send request
    try:
        res = requests.post(
            f"{BASE_URL}/upload",
            files=files,
            data=data,
            headers=headers,
            timeout=30
        )
        
        print(f"\n✓ Status: {res.status_code}")
        print(f"✓ Response: {json.dumps(res.json(), indent=2)}")
        
        # Assertions
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        response_json = res.json()
        assert "id" in response_json, "Missing 'id' in response"
        assert response_json["checksum"] == checksum, "Checksum mismatch"
        assert response_json["status"] == "processed", "Status should be 'processed'"
        
        print("\n✅ UPLOAD TEST PASSED\n")
        return response_json["id"]
        
    except Exception as e:
        print(f"\n❌ UPLOAD TEST FAILED: {e}\n")
        return None


# ============================================================================
# TEST 2: State Endpoint (/state)
# ============================================================================

def test_state():
    print("="*70)
    print("TEST 2: POST /files/state")
    print("="*70)
    
    print("📊 Fetching combined state hash and file count...")
    
    try:
        res = requests.post(
            f"{BASE_URL}/state",
            headers=HEADERS,
            timeout=30
        )
        
        print(f"\n✓ Status: {res.status_code}")
        response_json = res.json()
        print(f"✓ Response: {json.dumps(response_json, indent=2)}")
        
        # Assertions
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        assert "stateHash" in response_json, "Missing 'stateHash' in response"
        assert "fileCount" in response_json, "Missing 'fileCount' in response"
        
        state_hash = response_json["stateHash"]
        file_count = response_json["fileCount"]
        
        print(f"\n📈 State Hash: {state_hash[:16]}...")
        print(f"📂 Total files: {file_count}")
        print("\n✅ STATE TEST PASSED\n")
        
        return state_hash
        
    except Exception as e:
        print(f"\n❌ STATE TEST FAILED: {e}\n")
        return None


# ============================================================================
# TEST 3: Sync Endpoint (/sync)
# ============================================================================

def test_sync(version: int = 0, limit: int = 100):
    print("="*70)
    print("TEST 3: GET /files/sync")
    print("="*70)
    
    print(f"🔄 Syncing changes from version {version} with limit {limit}...")
    
    try:
        res = requests.get(  # Changed from POST to GET
            f"{BASE_URL}/sync",
            params={
                "version": str(version),
                "limit": str(limit)
            },
            headers=HEADERS,
            timeout=30
        )
        
        print(f"\n✓ Status: {res.status_code}")
        response_json = res.json()
        
        # Pretty print response
        print(f"✓ Response structure:")
        print(json.dumps(response_json, indent=2, default=str))
        
        # Assertions
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        assert "items" in response_json, "Missing 'items' in response"
        assert "deletedIds" in response_json, "Missing 'deletedIds' in response"
        assert "nextVersion" in response_json, "Missing 'nextVersion' in response"
        
        items = response_json.get("items", [])
        deleted_ids = response_json.get("deletedIds", [])
        next_version = response_json.get("nextVersion")
        
        print(f"\n📄 Items: {len(items)} changes")
        print(f"🗑️  Deleted: {len(deleted_ids)} files")
        print(f"⏭️  Next version: {next_version}")
        
        if items:
            print(f"\n   Sample change:")
            sample = items[0]
            print(f"   - ID: {sample.get('id')[:16]}...")
            print(f"   - Name: {sample.get('name')}")
            print(f"   - Size: {sample.get('size')} bytes")
            print(f"   - MIME: {sample.get('mimeType')}")
        
        print("\n✅ SYNC TEST PASSED\n")
        return response_json
        
    except Exception as e:
        print(f"\n❌ SYNC TEST FAILED: {e}\n")
        return None


# ============================================================================
# TEST 4: Corrupted File Detection
# ============================================================================

def test_corruption_detection():
    print("="*70)
    print("TEST 4: Corruption Detection (negative test)")
    print("="*70)
    
    print("🔴 Testing upload with mismatched checksum...")
    
    file_data = create_test_file("corrupt_test.pdf", size_kb=25)
    wrong_checksum = calculate_sha256(b"wrong data")  # Intentionally wrong
    actual_checksum = calculate_sha256(file_data)
    
    creation_date = datetime.utcnow().isoformat() + "Z"
    
    files = {
        "file": ("corrupt_test.pdf", file_data, "application/pdf")
    }
    
    data = {
        "creationDate": creation_date,
        "mimeType": "application/pdf",
        "originalName": "corrupt_test.pdf"
    }
    
    headers = HEADERS.copy()
    headers["X-SHA256-Checksum"] = wrong_checksum
    
    try:
        res = requests.post(
            f"{BASE_URL}/upload",
            files=files,
            data=data,
            headers=headers,
            timeout=30
        )
        
        print(f"\n✓ Status: {res.status_code}")
        print(f"✓ Response: {json.dumps(res.json(), indent=2)}")
        
        # We expect this to fail
        assert res.status_code == 400, f"Expected 400 (bad request), got {res.status_code}"
        assert "corrupted" in res.json().get("error", "").lower(), \
            "Expected 'corrupted' in error message"
        
        print("\n✅ CORRUPTION DETECTION TEST PASSED (correctly rejected malformed request)\n")
        
    except Exception as e:
        print(f"\n❌ CORRUPTION DETECTION TEST FAILED: {e}\n")


# ============================================================================
# TEST 5: Incremental Sync
# ============================================================================

def test_incremental_sync():
    print("="*70)
    print("TEST 5: Incremental Sync (version tracking)")
    print("="*70)
    
    print("🔄 Testing sync from various version points...")
    
    # Sync from version 0 (full sync)
    print("\n1️⃣  Full sync (version=0):")
    full_sync = test_sync(version=0, limit=10)
    
    if full_sync and isinstance(full_sync, dict):
        next_ver = full_sync.get("nextVersion", 0)
        
        # Now sync from a later version (should have fewer items)
        time.sleep(1)  # Small delay
        print(f"\n2️⃣  Incremental sync (version={next_ver}):")
        incremental_sync = test_sync(version=next_ver, limit=10)
        
        if incremental_sync:
            print("✅ INCREMENTAL SYNC TEST PASSED\n")
        else:
            print("⚠️  Could not complete incremental sync test\n")
    else:
        print("⚠️  Could not complete full sync, skipping incremental test\n")


# ============================================================================
# Main Test Suite
# ============================================================================

def run_all_tests():
    print("\n")
    print("█" * 70)
    print("█" + " " * 68 + "█")
    print("█" + "  CCloud FileOps Endpoint Test Suite".center(68) + "█")
    print("█" + " " * 68 + "█")
    print("█" * 70)
    
    # Run tests in sequence
    file_id = test_upload()
    
    state_hash = test_state()
    
    test_sync(version=0, limit=50)
    
    test_corruption_detection()
    
    test_incremental_sync()
    
    # Summary
    print("\n" + "█" * 70)
    print("█" + "  Test Suite Complete".center(68) + "█")
    print("█" * 70 + "\n")


if __name__ == "__main__":
    run_all_tests()