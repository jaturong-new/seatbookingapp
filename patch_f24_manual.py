import json

# Start offset to ensure this bottom half is below the top half
R = 20

F24_BOTTOM_LAYOUT = {
    # ---------------- Row 0 ----------------
    "ศรินญา (นุ่น)": (R+0, 0),
    "AS400: ธนาภา (แนท)": (R+0, 2),
    "AS400: นภาวรรณ (แตง)": (R+0, 3),
    "AS400: กชพร (เพลิน)": (R+0, 4),
    "AS400: ชัยพร (เติ้ล)": (R+0, 5),
    "รสรินทร์ (เชอรี่)": (R+0, 8),

    # ---------------- Row 1 ----------------
    "AS400: วัชร (นอต)": (R+1, 2),
    "AS400: ณัฐวุฒิ (วุฒิ)": (R+1, 3),
    "AS400: ปัญจพล (เจ๋ง)": (R+1, 4),
    "AS400: พีรพงษ์ (เบนซ์)": (R+1, 5),
    "SA : บรมเศรษฐ์ฉาย (ฟู)": (R+1, 8),
    "SA : ธนโชติ (โชต)": (R+1, 9),

    # ---------------- Row 3 ----------------
    "ปรีชาชาญ (ป้อง)": (R+3, 0),
    "AS400: เขมชาติ (นัท)": (R+3, 2),
    "AS400: สุทธิชาติ (มังกร)": (R+3, 3),
    "F24-C3": (R+3, 4),
    "F24-C4": (R+3, 5),
    "F24-C5": (R+3, 8),
    "F24-C6": (R+3, 9),

    # ---------------- Row 4 ----------------
    "PMO: วัลลภ (โอ๊ต)": (R+4, 2),
    "PMO: นันทิพา (จุ๊บ)": (R+4, 3),
    "PMO: พิชญา (ป่าน)": (R+4, 4),
    "F24-D4": (R+4, 5),
    "F24-D5": (R+4, 8),
    "F24-D6": (R+4, 9),

    # ---------------- Row 6 ----------------
    "สมชาย (โตน)": (R+6, 0),
    "F24-E1": (R+6, 2),
    "F24-E2": (R+6, 3),
    "F24-E3": (R+6, 4),
    "F24-E4": (R+6, 5),
    "ประตู": (R+6, 9),

    # ---------------- Row 7 ----------------
    "F24-F1": (R+7, 2),
    "F24-F2": (R+7, 3),
    "F24-F3": (R+7, 4),
    "F24-F4": (R+7, 5),

    # ---------------- Row 9 ----------------
    "Lead Dev: นิตินัย (น๊อต)": (R+9, 2),
    "F24-G2": (R+9, 3),
    "F24-G3": (R+9, 4),
    "F24-G4": (R+9, 5),

    # ---------------- Row 10 ----------------
    "PM: ศุภพิชญ์ (พิชญ์)": (R+10, 2),
    "F24-H2": (R+10, 3),
    "F24-H3": (R+10, 4),
    "F24-H4": (R+10, 5),

    # ---------------- Row 12 ----------------
    "พี่บังอร": (R+12, 0),
    "สุกัญญา (ตูน)": (R+12, 2),
    "Infra: Vendor": (R+12, 3),
    "รัฐพล (จิว)": (R+12, 4),
    "จิฏิณ (บอม)": (R+12, 5),
}

with open("data/seed.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# First, let's remove any automated F24 bottom-half seats that might clash or are duplicated
# The names from the automated script might not have "AS400:" prefix. So we should wipe the old ones that contain these names.
names_to_remove = [
    "ศรินญา", "ธนาภา", "นภาวรรณ", "กชพร", "ชัยพร", "รสรินทร์",
    "วัชร", "ณัฐวุฒิ", "ปัญจพล", "พีรพงษ์", "บรมเศรษฐ์ฉาย", "ธนโชติ",
    "ปรีชาชาญ", "เขมชาติ", "สุทธิชาติ", "วัลลภ", "นันทิพา", "พิชญา",
    "สมชาย", "นิตินัย", "ศุภพิชญ์", "พี่บังอร", "สุกัญญา", "รัฐพล", "จิฏิณ"
]

data["seats"] = [
    s for s in data["seats"]
    if not (s["floor_code"] == "F24" and any(n in s["full_code"] for n in names_to_remove))
]

seen_codes = set()

# Update existing F24 seats if they match exactly
for seat in data["seats"]:
    if seat["floor_code"] == "F24":
        full_code = seat["full_code"]
        if full_code in F24_BOTTOM_LAYOUT:
            row, col = F24_BOTTOM_LAYOUT[full_code]
            seat["grid_row"] = row
            seat["grid_col"] = col
            seen_codes.add(full_code)

# Add missing fixed seats
for full_code, (row, col) in F24_BOTTOM_LAYOUT.items():
    if full_code not in seen_codes:
        new_seat = {
            "floor_code": "F24",
            "row_letter": "FIXED",
            "col_number": 0,
            "code": full_code if not full_code.startswith("F24-") else full_code.split("-")[1],
            "full_code": full_code,
            "grid_row": row,
            "grid_col": col
        }
        data["seats"].append(new_seat)

with open("data/seed.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Patched F24 bottom half successfully to perfectly match the Excel image.")
