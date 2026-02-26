import hashlib
import requests
import time
from datetime import datetime
from pathlib import Path

# Configuration
BASE_URL = "http://aurelion.local:8000/files/upload"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAxOWM2MmQ3LWIxMGItNzY1ZS04ZDNhLWU1MmJmNjQ1MWNjOCIsImVtYWlsIjoiZG1lNTI0NUBnbWFpbC5jb20iLCJuYW1lIjoiZGVsbGFubyIsImlhdCI6MTc3MjExNDE1NSwiZXhwIjoxNzcyMTI0OTU1fQ.fi33AOr_Cvj4A5KxeCGPStCmBohZDKi_kbsx0TVwQ6w"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
}


def calculate_sha256(data: bytes) -> str:
    """Calculate SHA256 checksum of data"""
    return hashlib.sha256(data).hexdigest()


def upload_png():
    """Upload PNG file with comprehensive timing metrics"""
    file_path = Path("dellano.png")

    if not file_path.exists():
        raise FileNotFoundError("dellano.png not found in current directory")

    # Read file
    file_data = file_path.read_bytes()
    file_size = len(file_data)
    checksum = calculate_sha256(file_data)
    creation_date = datetime.utcnow().isoformat() + "Z"

    files = {
        "file": ("dellano.png", file_data, "image/png")
    }

    data = {
        "creationDate": creation_date,
        "mimeType": "image/png",
        "originalName": "dellano.png"
    }

    headers = HEADERS.copy()
    headers["X-SHA256-Checksum"] = checksum

    # Pre-request info
    print("\n" + "="*70)
    print("FILE UPLOAD REQUEST")
    print("="*70)
    print(f"File Name:        dellano.png")
    print(f"File Size:        {file_size} bytes ({file_size / 1024:.2f} KB)")
    print(f"SHA256:           {checksum}")
    print(f"Creation Date:    {creation_date}")
    print(f"Endpoint:         POST {BASE_URL}")
    print("="*70)

    # Timing request
    start = time.perf_counter()
    response = requests.post(
        BASE_URL,
        files=files,
        data=data,
        headers=headers,
        timeout=30
    )
    end = time.perf_counter()
    elapsed = end - start

    # Response metrics
    response_size = len(response.content)
    print(f"\nStatus Code:      {response.status_code}")
    print(f"Response Time:    {elapsed*1000:.2f}ms ({elapsed:.4f}s)")
    print(f"Response Size:    {response_size} bytes")
    print(f"Upload Speed:     {file_size / elapsed / (1024*1024):.2f} MB/s" if elapsed > 0 else "N/A")
    
    # Response headers
    print(f"\nResponse Headers:")
    for key, value in response.headers.items():
        print(f"  {key}: {value}")
    
    print(f"\nResponse Body:")
    print(f"  {response.text}")
    print("="*70 + "\n")


if __name__ == "__main__":
    upload_png()