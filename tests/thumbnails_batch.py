import requests
import time

BASE_URL = "http://localhost:8000"
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

# ---- timing ----
start = time.perf_counter()
response = requests.post(url, headers=headers, json=payload)
end = time.perf_counter()
elapsed = end - start
# ----------------

print("Status:", response.status_code)
print("Content-Type:", response.headers.get("Content-Type"))
print("Response size:", len(response.content))
print(f"Elapsed time: {elapsed:.4f} seconds")
#print(response.text)

if response.status_code == 200:
    with open("thumbnails.zip", "wb") as f:
        f.write(response.content)
    print("Saved thumbnails.zip")