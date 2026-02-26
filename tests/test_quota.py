import requests

BASE_URL = "http://localhost:8000"
ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAxOWM2MmQ3LWIxMGItNzY1ZS04ZDNhLWU1MmJmNjQ1MWNjOCIsImVtYWlsIjoiZG1lNTI0NUBnbWFpbC5jb20iLCJuYW1lIjoiZGVsbGFubyIsImlhdCI6MTc3MjExNDE1NSwiZXhwIjoxNzcyMTI0OTU1fQ.fi33AOr_Cvj4A5KxeCGPStCmBohZDKi_kbsx0TVwQ6w"

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json"
}


def test_quota() -> None:
    url = f"{BASE_URL}/user/quota"
    resp = requests.get(url, headers=headers)
    print(f"GET {url} -> {resp.status_code}")
    try:
        print(resp.json())
    except ValueError:
        print(resp.text)



def test_get_profile():
    url = f"{BASE_URL}/user/profile"
    resp = requests.get(url, headers=headers)
    print(f"GET {url} -> {resp.status_code}")
    try:
        print(resp.json())
    except ValueError:
        print(resp.text)


def test_update_profile():
    url = f"{BASE_URL}/user/profile"
    data = {
        "name": "Dellano Samuel",
    }
    resp = requests.patch(url, json=data, headers=headers)
    print(f"PATCH {url} -> {resp.status_code}")
    try:
        print(resp.json())
    except ValueError:
        print(resp.text)    


if __name__ == "__main__":
    test_quota()
    test_get_profile()
    test_update_profile()