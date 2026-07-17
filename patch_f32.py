import json

# Full F32 layout from PDF:
# Grid reference (row, col) — 0-indexed
# Left block cols 0-5, right block cols 6-10
F32_LAYOUT = {
    # ---- Row 0: A-row ----
    "เฉลิมพงษ์ (ปุ๊)":          (0, 1),
    "อัญดาธร ชมภูวงศ์":       (0, 3),
    "F32-A2":                  (0, 4),
    "F32-A3":                  (0, 5),
    "สิริพร ศรีคํา":            (0, 6),

    # ---- Row 1: B-row ----
    "F32-B1":                  (1, 3),
    "ภูวสิษฏ์ ผลรุ่งเจริญวงษ์":  (1, 4),

    # ---- Row 2: gap row ----

    # ---- Row 3: C-row ----
    "F32-C1":                  (3, 3),
    "F32-C2":                  (3, 4),
    "F32-C3":                  (3, 5),
    "กรรณิการ์ พุทธรอด":       (3, 6),

    # ---- Row 4: gap ----

    # ---- Row 5: E-row ----
    "F32-E1":                  (5, 1),
    "F32-E2":                  (5, 2),
    "F32-E3":                  (5, 3),
    "F32-E4":                  (5, 4),
    "วสันต์ เพียรมาก":         (5, 5),   # fixed
    "ธนาวุฒิ ประเสริฐสังข์":   (5, 6),   # fixed

    # ---- Row 6: F-row ----
    "F32-F1":                  (6, 1),
    "F32-F3":                  (6, 3),
    "ธีระเดช ทวีบุญรุ่งเรื่อง": (6, 4),   # fixed
    "นักศึกษาฝึกงาน":          (6, 5),   # fixed label
    "พัลลภ นุตาลัย":            (6, 6),   # fixed

    # ---- Row 7: gap ----

    # ---- Row 8: G-row ----
    "F32-G1":                  (8, 1),
    "F32-G2":                  (8, 2),
    "F32-G3":                  (8, 3),
    "สมหญิง (หญิง)":           (8, 4),   # fixed
    "นุสรา (นก)":              (8, 6),   # fixed

    # ---- Row 9: H-row ----
    "F32-H1":                  (9, 1),
    "F32-H2":                  (9, 2),
    "F32-H3":                  (9, 3),
    "ศศินันท์ (นก)":           (9, 4),   # fixed

    # ---- Row 10: gap row ----

    # ---- Row 11: K-row ----
    "F32-K1":                  (11, 1),
    "F32-K2":                  (11, 2),
    "F32-K3":                  (11, 3),
    "F32-K4":                  (11, 4),
    "F32-K5":                  (11, 5),
    "SA : พงศ์ธิป (พง)":       (11, 6),

    # ---- Row 12: L-row ----
    "F32-L1":                  (12, 1),
    "F32-L2":                  (12, 2),
    "F32-L3":                  (12, 3),
    "F32-L4":                  (12, 4),
    "F32-L5":                  (12, 5),
    "SA : ชุติมา (อั๋น)":      (12, 6),

    # ---- Row 13: gap & Door ----
    "ประตู":                   (13, 0),

    # ---- Row 14: M-row ----
    "F32-M1":                  (14, 1),
    "F32-M2":                  (14, 2),
    "F32-M3":                  (14, 3),
    "F32-M4":                  (14, 4),
    "F32-M5":                  (14, 5),
    "วรพงศ์ (พงศ์)":           (14, 6),

    # ---- Row 15: N-row ----
    "F32-N1":                  (15, 1),
    "F32-N2":                  (15, 2),
    "F32-N3":                  (15, 3),
    "F32-N4":                  (15, 4),
    "F32-N5":                  (15, 5),
    "F32-N6":                  (15, 6),

    # ---- Row 16: gap ----

    # ---- Row 17: วโรฒน์ ----
    "วโรฒน์ (แบงค์)":          (17, 6),

    # ---- Row 18: O-row ----
    "F32-O1":                  (18, 4),
    "F32-O2":                  (18, 5),

    # ---- Row 19: gap ----

    # ---- Row 20: P-row ----
    "F32-P1":                  (20, 1),
    "F32-P2":                  (20, 2),
    "F32-P3":                  (20, 4),
    "F32-P4":                  (20, 5),
    "F32-P5":                  (20, 6),

    # ---- Row 21: Q-row ----
    "F32-Q1":                  (21, 1),
    "F32-Q2":                  (21, 2),
    "F32-Q3":                  (21, 4),
    "F32-Q4":                  (21, 5),
    "F32-Q5":                  (21, 6),

    # ---- Row 22: Fixed + ไม่มีที่นั่ง ----
    "ทัศนกมล (โบ)":            (22, 1),
    "วีรพงศ์ (กร)":            (22, 2),
    "ไม่มีที่นั่ง":             (22, 4),
}

# Seats where full code starts with person name (fixed) vs F32-code (mobile)
# Fixed = NOT starting with "F32-" and NOT "Bar Seat" / "ประตู"
MOBILE_CODES = {"F32-A2","F32-A3","F32-B1","F32-C1","F32-C2","F32-C3",
                "F32-E1","F32-E2","F32-E3","F32-E4",
                "F32-F1","F32-F3",
                "F32-G1","F32-G2","F32-G3",
                "F32-H1","F32-H2","F32-H3",
                "F32-K1","F32-K2","F32-K3","F32-K4","F32-K5",
                "F32-L1","F32-L2","F32-L3","F32-L4","F32-L5",
                "F32-M1","F32-M2","F32-M3","F32-M4","F32-M5",
                "F32-N1","F32-N2","F32-N3","F32-N4","F32-N5","F32-N6",
                "F32-O1","F32-O2",
                "F32-P1","F32-P2","F32-P3","F32-P4","F32-P5",
                "F32-Q1","F32-Q2","F32-Q3","F32-Q4","F32-Q5"}

DOOR_CODES  = {"ประตู"}
BAR_CODES   = {"Bar Seat 1","Bar Seat 2","Bar Seat 3","Bar Seat 4"}

with open("data/seed.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Remove all existing F32 seats
data["seats"] = [s for s in data["seats"] if s["floor_code"] != "F32"]

# Re-add from layout
for full_code, (row, col) in F32_LAYOUT.items():
    if full_code in DOOR_CODES:
        row_letter = "DOOR"
    elif full_code in BAR_CODES:
        row_letter = "BAR"
    elif full_code in MOBILE_CODES:
        row_letter = full_code.split("-")[1][0]   # e.g. "F32-K3" -> "K"
        col_number_str = full_code.split("-")[1][1:]
        try:
            col_num = int(col_number_str)
        except:
            col_num = 0
    else:
        row_letter = "FIXED"

    code = full_code.split("-")[1] if full_code.startswith("F32-") else full_code
    col_num = 0

    data["seats"].append({
        "floor_code": "F32",
        "row_letter": row_letter,
        "col_number": col_num,
        "code": code,
        "full_code": full_code,
        "grid_row": row,
        "grid_col": col,
    })

with open("data/seed.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

f32_new = [s for s in data["seats"] if s["floor_code"] == "F32"]
print(f"F32 patched: {len(f32_new)} seats total")
for s in sorted(f32_new, key=lambda x:(x["grid_row"],x["grid_col"])):
    print(f"  row={s['grid_row']:2d} col={s['grid_col']:2d}  {s['full_code'][:35]}")
