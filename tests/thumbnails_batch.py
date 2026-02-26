import requests
import time

BASE_URL = "http://aurelion.local:8000"
ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAxOWM2MmQ3LWIxMGItNzY1ZS04ZDNhLWU1MmJmNjQ1MWNjOCIsImVtYWlsIjoiZG1lNTI0NUBnbWFpbC5jb20iLCJuYW1lIjoiZGVsbGFubyIsImlhdCI6MTc3MTY5Mzc1OCwiZXhwIjoxNzcxNzA0NTU4fQ.KE_Kpt6N1df5siFb1IxOEU5ROdorEuY6DBNnVE9Wygg"

url = f"{BASE_URL}/files/thumbnails/batch"

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json"
}

payload = {
    "fileIds": ["ad652bfe4d26a3dca4d3aba2bad9e56405870358c02f38a4f084cb6835663e75"],
    "size": "small"
}


def print_request_metrics(status_code: int, elapsed_time: float, response_size: int, 
                         response_headers: dict, method: str = "POST") -> None:
    """Print formatted request metrics"""
    print(f"\n{'='*70}")
    print(f"REQUEST: {method} /files/thumbnails/batch")
    print(f"{'='*70}")
    print(f"Status Code:      {status_code}")
    print(f"Response Time:    {elapsed_time*1000:.2f}ms ({elapsed_time:.4f}s)")
    print(f"Response Size:    {response_size} bytes ({response_size / 1024:.2f} KB)")
    print(f"Download Speed:   {response_size / elapsed_time / (1024*1024):.2f} MB/s" if elapsed_time > 0 else "N/A")
    
    print(f"\nResponse Headers:")
    for key, value in response_headers.items():
        print(f"  {key}: {value}")
    print(f"{'='*70}")


# Request payload info
print("\n" + "="*70)
print("BATCH THUMBNAILS REQUEST")
print("="*70)
print(f"Endpoint:         POST {url}")
print(f"Request Payload:")
print(f"  fileIds:        {payload['fileIds']}")
print(f"  size:           {payload['size']}")
print("="*70)

# ---- timing request ----
start = time.perf_counter()
response = requests.post(url, headers=headers, json=payload)
end = time.perf_counter()
elapsed = end - start
# --------

response_size = len(response.content)

print_request_metrics(response.status_code, elapsed, response_size, response.headers)

# Save response if successful
if response.status_code == 200:
    with open("thumbnails.zip", "wb") as f:
        f.write(response.content)
    print(f"\n✓ Saved thumbnails.zip ({response_size} bytes)")
else:
    print(f"\n✗ Request failed with status {response.status_code}")
    print(f"Response Body: {response.text}")

print()