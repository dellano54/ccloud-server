import hashlib
import requests
from datetime import datetime
from pathlib import Path

FILE_PATH = Path("dellano1.png")
URL = "http://localhost:8000/files/upload"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAxOWM2MmQ3LWIxMGItNzY1ZS04ZDNhLWU1MmJmNjQ1MWNjOCIsImVtYWlsIjoiZG1lNTI0NUBnbWFpbC5jb20iLCJuYW1lIjoiZGVsbGFubyIsImlhdCI6MTc3MTM0Njc4MywiZXhwIjoxNzcxMzU3NTgzfQ.1dN6RrtDsbyqOLYfeNpAtYlsaKn0G50RJtjBK-N01mQ"

# Read file as binary
data = FILE_PATH.read_bytes()

# Compute SHA-256
sha256 = hashlib.sha256(data).hexdigest()

files = {
    "file": (
        FILE_PATH.name,
        data,
        "image/jpeg"
    )
}

form = {
    "file": files['file'][1],
    "creationDate": datetime.utcnow().isoformat() + "Z",
    "mimeType": "image/png",
    "originalName": FILE_PATH.name,
    
}

assert FILE_PATH.exists(), "File does not exist"

# Read binary
binary = FILE_PATH.read_bytes()

# Compute checksum
checksum = hashlib.sha256(binary).hexdigest()

# Multipart payload
files = {
    "file": (
        FILE_PATH.name,
        binary,
        "image/png"
    )
}

data = {
    "creationDate": datetime.utcnow().isoformat() + "Z",
    "mimeType": "image/png",
    "originalName": FILE_PATH.name
}

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "X-SHA256-Checksum": checksum
}

# Send request
res = requests.post(
    URL,
    files=files,
    data=data,
    headers=headers,
    timeout=15
)

# ---------- RESULTS ----------
print("Status:", res.status_code)
print("Response:", res.text)

# ---------- ASSERTIONS ----------
assert res.status_code == 200, "Upload failed"
assert checksum in res.text, "Checksum mismatch"

print("✅ Upload + checksum verification PASSED")
