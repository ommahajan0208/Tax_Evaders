import urllib.request
import json

# Test via Vite proxy (same as frontend would)
url = "http://127.0.0.1:5173/api/auth/login"
data = json.dumps({"username": "admin", "password": "adminpassword"}).encode("utf-8")
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

try:
    resp = urllib.request.urlopen(req)
    print("VIA VITE PROXY - SUCCESS:", resp.read().decode())
except urllib.error.HTTPError as e:
    print(f"VIA VITE PROXY - ERROR {e.code}:", e.read().decode())
