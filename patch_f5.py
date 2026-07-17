import json

F5_LAYOUT = {
    # ---------------- Grid Row 0 (Door) ----------------
    "F5-ประตู": (0, 9),

    # ---------------- Grid Row 1 ----------------
    "ธงชัย": (1, 2),
    "F5-A2": (1, 3),
    "F5-A3": (1, 4),

    # ---------------- Grid Row 2 (Empty Gap) ----------------

    # ---------------- Grid Row 3 ----------------
    "กิตติพงษ์": (3, 0),
    "อภิมุข": (3, 2),
    "F5-B2": (3, 3),
    "F5-B3": (3, 4),
    "F5-B4": (3, 5),

    # ---------------- Grid Row 4 ----------------
    "อัครพล": (4, 0),
    "F5-C2": (4, 1),
    "F5-C3": (4, 2),
    "F5-C4": (4, 3),
    "F5-C5": (4, 4),
    "F5-C6": (4, 5),

    # ---------------- Grid Row 5 (Gap for left, Row 1 for right) ----------------
    "ปาริฉัตร": (5, 7),
    # Col 8 is GAP
    "F5-I4": (5, 9),
    "ขนิษฐา": (5, 10),
    # Col 11 is GAP
    "อนุชา": (5, 12),
    "F5-L1": (5, 13),
    # Col 14 is GAP (1-column gap now)
    "F5-M1": (5, 15),
    "Bar1": (5, 16),

    # ---------------- Grid Row 6 (Row D for left, Row 2 for right) ----------------
    "ฉัตรนรินทร์": (6, 0),
    "F5-D2": (6, 1),
    "F5-D3": (6, 2),
    "F5-D4": (6, 3),
    "F5-D5": (6, 4),
    "F5-D6": (6, 5),

    "ศิริศักดิ์": (6, 7),
    "F5-I3": (6, 9),
    "ทินกรณ์": (6, 10),
    "ธนากฤต": (6, 12),
    "F5-L2": (6, 13),
    "F5-M2": (6, 15),
    "Bar2": (6, 16),

    # ---------------- Grid Row 7 (Row E for left, Row 3 for right) ----------------
    "ธนะสิทธิ์": (7, 0),
    "F5-E2": (7, 1),
    "F5-E3": (7, 2),
    "F5-E4": (7, 3),
    "F5-E5": (7, 4),
    "F5-E6": (7, 5),

    "วรัชญา": (7, 7),
    "F5-I2": (7, 9),
    "วารุณี": (7, 10),
    "รังสิมันต์": (7, 12),
    "F5-L3": (7, 13),
    "F5-M3": (7, 15),
    "Bar3": (7, 16),

    # ---------------- Grid Row 8 (Gap for left, Row 4 for right) ----------------
    "ประพันธ์": (8, 7),
    "ปณิชา": (8, 9),
    "อมรพรรณ": (8, 10),
    "ศุภชัย": (8, 12),
    "F5-L4": (8, 13),
    "F5-M4": (8, 15),
    "Bar4": (8, 16),

    # ---------------- Grid Row 9 (Row F for left, Row 5 for right) ----------------
    "สิริรัตน์": (9, 2),
    "F5-F2": (9, 3),
    "F5-F3": (9, 4),
    "F5-F4": (9, 5),

    "กันต์กมล": (9, 12),
    "F5-L5": (9, 13),

    # ---------------- Grid Row 10 (Row G for left, Row 6 for right) ----------------
    "ณภัค": (10, 2),
    "ภัทร์ปรียา": (10, 3),
    "F5-G3": (10, 4),
    "F5-G4": (10, 5),

    "สุลัดดา": (10, 10),
    "โชติกา": (10, 12),
    "F5-L6": (10, 13),
}

with open("data/seed.json", "r", encoding="utf-8") as f:
    data = json.load(f)

seen_codes = set()

# Update existing F5 seats
for seat in data["seats"]:
    if seat["floor_code"] == "F5":
        full_code = seat["full_code"]
        if full_code in F5_LAYOUT:
            row, col = F5_LAYOUT[full_code]
            seat["grid_row"] = row
            seat["grid_col"] = col
            seen_codes.add(full_code)

# Clean up seats that are NOT in F5_LAYOUT
data["seats"] = [
    seat for seat in data["seats"] 
    if seat["floor_code"] != "F5" or seat["full_code"] in F5_LAYOUT
]

# Add missing seats (fixed seats)
for full_code, (row, col) in F5_LAYOUT.items():
    if full_code not in seen_codes:
        new_seat = {
            "floor_code": "F5",
            "row_letter": "FIXED",
            "col_number": 0,
            "code": full_code if not full_code.startswith("F5-") else full_code.split("-")[1],
            "full_code": full_code,
            "grid_row": row,
            "grid_col": col
        }
        data["seats"].append(new_seat)

with open("data/seed.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Patched F5 successfully to perfectly match the Excel image gaps.")
