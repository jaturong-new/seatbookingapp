import json

DOORS = [
    {"floor_code": "F5", "grid_row": 3, "grid_col": 9},
    {"floor_code": "F24", "grid_row": 14, "grid_col": 9},
    {"floor_code": "F32", "grid_row": 10, "grid_col": 8}
]

with open("data/seed.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for d in DOORS:
    # Check if door already exists on this floor
    exists = any(s["floor_code"] == d["floor_code"] and s["code"] == "ประตู" for s in data["seats"])
    if not exists:
        data["seats"].append({
            "floor_code": d["floor_code"],
            "row_letter": "DOOR",
            "col_number": 0,
            "code": "ประตู",
            "full_code": f"{d['floor_code']}-ประตู",
            "grid_row": d["grid_row"],
            "grid_col": d["grid_col"]
        })

with open("data/seed.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Added doors to F5, F24, F32.")
