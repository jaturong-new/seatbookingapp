import json

F24_LAYOUT = {
    # ---------------- Top Half (Neatly Organized) ----------------
    "เฉลิมพงษ์ (ปุ๊)": (0, 0),
    "อัญดาธร ชมภูวงค": (0, 2),
    "สิริพร ศรีคํา": (0, 3),
    "ภูวสิษฏ ผลรุงเจริญวงษ": (0, 4),
    "กรรณิการ พุทธรอด": (0, 5),

    "วสันต เพียรมาก": (1, 2),
    "ธนาวุฒิ ประเสริฐสังข": (1, 3),
    "ธีระเดช ทวีบุญรุงเรือง": (1, 4),
    "พัลลภ นุตาลัย": (1, 5),

    "สมหญิง": (2, 2),
    "ศศินันท (หญิง)": (2, 3),
    "นุสรา (นก)": (2, 4),
    "พงศธิป (พง)": (2, 5),

    "ชุติมา (อั๋น)": (3, 2),
    "วรพงศ (พงศ)": (3, 3),
    "วโรฒน (แบงค)": (3, 4),
    "สรัญญา": (3, 5),

    "โอ": (4, 2),
    "บี": (4, 3),
    "ทัศนกมล (โบ)": (4, 4),
    "วีรพงศ (กร)": (4, 5),

    # ---------------- Bottom Half (Exact Excel Mapping) ----------------
    "AS400: ธนาภา (แนท)": (8, 2),
    "AS400: นภาวรรณ (แตง)": (8, 3),
    "AS400: กชพร (เพลิน)": (8, 4),
    "AS400: ชัยพร (เติ้ล)": (8, 5),
    "รสรินทร์ (เชอรี่)": (8, 8),

    "ศรินญา (นุ่น)": (9, 0),
    "AS400: วัชร (นอต)": (9, 2),
    "AS400: ณัฐวุฒิ (วุฒิ)": (9, 3),
    "AS400: ปัญจพล (เจ๋ง)": (9, 4),
    "AS400: พีรพงษ์ (เบนซ์)": (9, 5),
    "SA : บรมเศรษฐ์ฉาย (ฟู)": (9, 8),
    "SA : ธนโชติ (โชต)": (9, 9),

    "ปรีชาชาญ (ป้อง)": (11, 0),
    "AS400: เขมชาติ (นัท)": (11, 2),
    "AS400: สุทธิชาติ (มังกร)": (11, 3),
    "F24-C3": (11, 4),
    "F24-C4": (11, 5),
    "F24-C5": (11, 8),
    "F24-C6": (11, 9),

    "PMO: วัลลภ (โอ๊ต)": (12, 2),
    "PMO: นันทิพา (จุ๊บ)": (12, 3),
    "PMO: พิชญา (ป่าน)": (12, 4),
    "F24-D4": (12, 5),
    "F24-D5": (12, 8),
    "F24-D6": (12, 9),

    "สมชาย (โตน)": (14, 0),
    "F24-E1": (14, 2),
    "F24-E2": (14, 3),
    "F24-E3": (14, 4),
    "F24-E4": (14, 5),
    "ประตู": (14, 9),

    "F24-F1": (15, 2),
    "F24-F2": (15, 3),
    "F24-F3": (15, 4),
    "F24-F4": (15, 5),

    "Lead Dev: นิตินัย (น๊อต)": (17, 2),
    "F24-G2": (17, 3),
    "F24-G3": (17, 4),
    "F24-G4": (17, 5),

    "PM: ศุภพิชญ์ (พิชญ์)": (18, 2),
    "F24-H2": (18, 3),
    "F24-H3": (18, 4),
    "F24-H4": (18, 5),

    "พี่บังอร": (20, 0),
    "สุกัญญา (ตูน)": (20, 2),
    "Infra: Vendor": (20, 3),
    "รัฐพล (จิว)": (20, 4),
    "จิฏิณ (บอม)": (20, 5),
}

with open("data/seed.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Keep only seats that are NOT in F24, OR are F24 pool seats that match F24_LAYOUT keys exactly
# Pool seats typically start with F24-
valid_pool_seats = [k for k in F24_LAYOUT.keys() if k.startswith("F24-")]

data["seats"] = [
    s for s in data["seats"]
    if s["floor_code"] != "F24" or s["full_code"] in valid_pool_seats
]

seen_codes = set()

# Update coordinates for valid F24 pool seats
for seat in data["seats"]:
    if seat["floor_code"] == "F24":
        full_code = seat["full_code"]
        if full_code in F24_LAYOUT:
            row, col = F24_LAYOUT[full_code]
            seat["grid_row"] = row
            seat["grid_col"] = col
            seen_codes.add(full_code)

# Add missing seats as FIXED
for full_code, (row, col) in F24_LAYOUT.items():
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

print("Patched F24 completely successfully.")
