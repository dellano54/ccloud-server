import requests

BASE_URL = "http://localhost:8000"
ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAxOWM2MmQ3LWIxMGItNzY1ZS04ZDNhLWU1MmJmNjQ1MWNjOCIsImVtYWlsIjoiZG1lNTI0NUBnbWFpbC5jb20iLCJuYW1lIjoiZGVsbGFubyIsImlhdCI6MTc3MjExNDE1NSwiZXhwIjoxNzcyMTI0OTU1fQ.fi33AOr_Cvj4A5KxeCGPStCmBohZDKi_kbsx0TVwQ6w"

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json"
}


def delete_file(file_id: str) -> None:
    url = f"{BASE_URL}/files/{file_id}"
    resp = requests.delete(url, headers=headers)
    print(f"DELETE {url} -> {resp.status_code}")
    try:
        print(resp.json())
    except ValueError:
        print(resp.text)


def test_album_flow(album_id = None) -> None:
    # create an album
    resp = requests.post(f"{BASE_URL}/albums", headers=headers, json={"title": "Travel 2024"})
    print("Create album ->", resp.status_code)
    print(resp.text)
    if resp.ok:
        album_id = resp.json().get("id")
    
    if album_id:
        # add files to album
        resp2 = requests.post(
            f"{BASE_URL}/albums/{album_id}/files",
            headers=headers,
            json={"fileIds": ["ad652bfe4d26a3dca4d3aba2bad9e56405870358c02f38a4f084cb6835663e75"]},
        )
        print("Add files ->", resp2.status_code)
        print(resp2.text)

    # sync albums
    resp3 = requests.get(f"{BASE_URL}/albums/sync", headers=headers)
    print("Sync albums ->", resp3.status_code)
    print(resp3.text)


if __name__ == "__main__":
    # deletion tests
    #delete_file("ad652bfe4d26a3dca4d3aba2bad9e56405870358c02f38a4f084cb6835663e75")          # expected success or failure depending on service
    delete_file("nonexistent")      # should produce 404

    # album & collection flow
    test_album_flow("dac2995a-2695-47ec-a14a-fccc3de29a97");
