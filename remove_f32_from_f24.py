import json

F32_NAMES = [
    "เฉลิมพงษ์ (ปุ๊)",
    "อัญดาธร ชมภูวงค",
    "สิริพร ศรีคํา",
    "ภูวสิษฏ ผลรุงเจริญวงษ",
    "กรรณิการ พุทธรอด",
    "วสันต เพียรมาก",
    "ธนาวุฒิ ประเสริฐสังข",
    "ธีระเดช ทวีบุญรุงเรือง",
    "พัลลภ นุตาลัย",
    "สมหญิง",
    "ศศินันท (หญิง)",
    "นุสรา (นก)",
    "พงศธิป (พง)",
    "ชุติมา (อั๋น)",
    "วรพงศ (พงศ)",
    "วโรฒน (แบงค)",
    "สรัญญา",
    "โอ",
    "บี",
    "ทัศนกมล (โบ)",
    "วีรพงศ (กร)"
]

with open("data/seed.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Remove these names from F24
# We check if the full_code matches any of the F32 names exactly or partially
data["seats"] = [
    s for s in data["seats"]
    if not (s["floor_code"] == "F24" and any(n in s["full_code"] for n in F32_NAMES))
]

with open("data/seed.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Removed F32 names from F24.")
