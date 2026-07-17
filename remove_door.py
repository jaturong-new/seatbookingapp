import json

with open("data/seed.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Remove "ประตู" from F24
data["seats"] = [
    s for s in data["seats"]
    if not (s["floor_code"] == "F24" and "ประตู" in s["full_code"])
]

with open("data/seed.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Removed 'ประตู' from F24.")
