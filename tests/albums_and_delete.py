import requests
import time
from typing import Dict, Any

BASE_URL = "http://aurelion.local:8000"
ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAxOWM2MmQ3LWIxMGItNzY1ZS04ZDNhLWU1MmJmNjQ1MWNjOCIsImVtYWlsIjoiZG1lNTI0NUBnbWFpbC5jb20iLCJuYW1lIjoiZGVsbGFubyIsImlhdCI6MTc3MjExNDE1NSwiZXhwIjoxNzcyMTI0OTU1fQ.fi33AOr_Cvj4A5KxeCGPStCmBohZDKi_kbsx0TVwQ6w"

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json"
}


def print_request_metrics(method: str, url: str, status_code: int, elapsed_time: float, 
                         response_size: int, response_data: Any = None) -> None:
    """Print formatted request metrics"""
    print(f"\n{'='*70}")
    print(f"REQUEST: {method} {url}")
    print(f"{'='*70}")
    print(f"Status Code:      {status_code}")
    print(f"Response Time:    {elapsed_time*1000:.2f}ms ({elapsed_time:.4f}s)")
    print(f"Response Size:    {response_size} bytes")
    if response_data:
        print(f"Response Body:    {response_data}")
    print(f"{'='*70}\n")


def delete_file(file_id: str) -> None:
    """Delete a file with timing metrics"""
    url = f"{BASE_URL}/files/{file_id}"
    
    start = time.perf_counter()
    resp = requests.delete(url, headers=headers)
    end = time.perf_counter()
    elapsed = end - start
    
    try:
        response_data = resp.json()
        response_size = len(resp.content)
    except ValueError:
        response_data = resp.text
        response_size = len(resp.text.encode())
    
    print_request_metrics("DELETE", url, resp.status_code, elapsed, response_size, response_data)


def test_album_flow(album_id=None) -> None:
    """Test album creation, file addition, and sync with timing metrics"""
    
    # Create an album
    print("\n[1] Creating album...")
    url = f"{BASE_URL}/albums"
    start = time.perf_counter()
    resp = requests.post(url, headers=headers, json={"title": "Travel 2024"})
    end = time.perf_counter()
    elapsed = end - start
    
    try:
        response_data = resp.json()
        response_size = len(resp.content)
    except ValueError:
        response_data = resp.text
        response_size = len(resp.text.encode())
    
    print_request_metrics("POST", url, resp.status_code, elapsed, response_size, response_data)
    
    if resp.ok:
        album_id = resp.json().get("id")
    
    # Add files to album
    if album_id:
        print("\n[2] Adding files to album...")
        url = f"{BASE_URL}/albums/{album_id}/files"
        payload = {"fileIds": ["ad652bfe4d26a3dca4d3aba2bad9e56405870358c02f38a4f084cb6835663e75"]}
        
        start = time.perf_counter()
        resp2 = requests.post(url, headers=headers, json=payload)
        end = time.perf_counter()
        elapsed = end - start
        
        try:
            response_data = resp2.json()
            response_size = len(resp2.content)
        except ValueError:
            response_data = resp2.text
            response_size = len(resp2.text.encode())
        
        print_request_metrics("POST", url, resp2.status_code, elapsed, response_size, response_data)

    # Sync albums
    print("\n[3] Syncing albums...")
    url = f"{BASE_URL}/albums/sync"
    start = time.perf_counter()
    resp3 = requests.get(url, headers=headers)
    end = time.perf_counter()
    elapsed = end - start
    
    try:
        response_data = resp3.json()
        response_size = len(resp3.content)
    except ValueError:
        response_data = resp3.text
        response_size = len(resp3.text.encode())
    
    print_request_metrics("GET", url, resp3.status_code, elapsed, response_size, response_data)


if __name__ == "__main__":
    print("\n" + "="*70)
    print("FILE DELETION TESTS")
    print("="*70)
    
    # deletion tests
    delete_file("nonexistent")  # should produce 404

    print("\n" + "="*70)
    print("ALBUM & COLLECTION FLOW")
    print("="*70)
    
    # album & collection flow
    test_album_flow("dac2995a-2695-47ec-a14a-fccc3de29a97")