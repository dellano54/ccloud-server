import hashlib
import requests
from datetime import datetime
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:8000/files/upload"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAxOWM2MmQ3LWIxMGItNzY1ZS04ZDNhLWU1MmJmNjQ1MWNjOCIsImVtYWlsIjoiZG1lNTI0NUBnbWFpbC5jb20iLCJuYW1lIjoiZGVsbGFubyIsImlhdCI6MTc3MjExNDE1NSwiZXhwIjoxNzcyMTI0OTU1fQ.fi33AOr_Cvj4A5KxeCGPStCmBohZDKi_kbsx0TVwQ6w"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
}

def calculate_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def upload_png():
    file_path = Path("dellano.png")

    if not file_path.exists():
        raise FileNotFoundError("dellano.png not found in current directory")

    file_data = file_path.read_bytes()
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

    response = requests.post(
        BASE_URL,
        files=files,
        data=data,
        headers=headers,
        timeout=30
    )

    print("Status:", response.status_code)
    print("Response:", response.text)

if __name__ == "__main__":
    upload_png()