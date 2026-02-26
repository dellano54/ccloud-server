import requests
import time

BASE_URL = "http://aurelion.local:8000"
ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAxOWM2MmQ3LWIxMGItNzY1ZS04ZDNhLWU1MmJmNjQ1MWNjOCIsImVtYWlsIjoiZG1lNTI0NUBnbWFpbC5jb20iLCJuYW1lIjoiZGVsbGFubyIsImlhdCI6MTc3MjExNDE1NSwiZXhwIjoxNzcyMTI0OTU1fQ.fi33AOr_Cvj4A5KxeCGPStCmBohZDKi_kbsx0TVwQ6w"

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json"
}


def print_request_metrics(method: str, url: str, status_code: int, elapsed_time: float, 
                         response_size: int, response_data: any = None) -> None:
    """Print formatted request metrics"""
    print(f"\n{'='*70}")
    print(f"REQUEST: {method} {url.replace(BASE_URL, '')}")
    print(f"{'='*70}")
    print(f"Status Code:      {status_code}")
    print(f"Response Time:    {elapsed_time*1000:.2f}ms ({elapsed_time:.4f}s)")
    print(f"Response Size:    {response_size} bytes")
    if response_data:
        print(f"Response Body:")
        if isinstance(response_data, dict):
            for key, value in response_data.items():
                print(f"  {key}: {value}")
        else:
            print(f"  {response_data}")
    print(f"{'='*70}")


def test_quota() -> None:
    """Get user quota with timing metrics"""
    url = f"{BASE_URL}/user/quota"
    
    start = time.perf_counter()
    resp = requests.get(url, headers=headers)
    end = time.perf_counter()
    elapsed = end - start
    
    try:
        response_data = resp.json()
        response_size = len(resp.content)
    except ValueError:
        response_data = resp.text
        response_size = len(resp.text.encode())
    
    print_request_metrics("GET", url, resp.status_code, elapsed, response_size, response_data)


def test_get_profile() -> None:
    """Get user profile with timing metrics"""
    url = f"{BASE_URL}/user/profile"
    
    start = time.perf_counter()
    resp = requests.get(url, headers=headers)
    end = time.perf_counter()
    elapsed = end - start
    
    try:
        response_data = resp.json()
        response_size = len(resp.content)
    except ValueError:
        response_data = resp.text
        response_size = len(resp.text.encode())
    
    print_request_metrics("GET", url, resp.status_code, elapsed, response_size, response_data)


def test_update_profile() -> None:
    """Update user profile with timing metrics"""
    url = f"{BASE_URL}/user/profile"
    data = {
        "name": "Dellano Samuel",
    }
    
    print(f"\nRequest Payload:")
    for key, value in data.items():
        print(f"  {key}: {value}")
    
    start = time.perf_counter()
    resp = requests.patch(url, json=data, headers=headers)
    end = time.perf_counter()
    elapsed = end - start
    
    try:
        response_data = resp.json()
        response_size = len(resp.content)
    except ValueError:
        response_data = resp.text
        response_size = len(resp.text.encode())
    
    print_request_metrics("PATCH", url, resp.status_code, elapsed, response_size, response_data)


if __name__ == "__main__":
    print("\n" + "="*70)
    print("USER API TESTS")
    print("="*70)
    
    print("\n[1] Testing User Quota")
    test_quota()
    
    print("\n[2] Getting User Profile")
    test_get_profile()
    
    print("\n[3] Updating User Profile")
    test_update_profile()
    
    print("\n" + "="*70)
    print("TESTS COMPLETED")
    print("="*70 + "\n")