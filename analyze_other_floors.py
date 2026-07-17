import xml.etree.ElementTree as ET
import re
import json

with open("output.html", "r", encoding="utf-8") as f:
    xml_data = f.read()

xml_data = xml_data.replace("&", "&amp;")
xml_data = re.sub(r' xmlns="[^"]+"', '', xml_data)

root = ET.fromstring(xml_data)

floors = {}

for page in root.findall(".//page"):
    texts = []
    for word in page.findall(".//word"):
        if word.text:
            texts.append((word.text, float(word.get("xMin")), float(word.get("yMin"))))
    
    # Sort
    texts.sort(key=lambda x: (round(x[2]/15)*15, x[1]))
    
    floor_label = None
    if any("F24-" in t[0] for t in texts): floor_label = "F24"
    elif any("F32-" in t[0] for t in texts): floor_label = "F32"
    
    if floor_label:
        floors[floor_label] = []
        for t in texts:
            if re.search(r'[ก-๙]', t[0]) or t[0].startswith(f"{floor_label}-") or "Bar" in t[0]:
                floors[floor_label].append({"text": t[0], "x": t[1], "y": t[2]})

with open("floors_data.json", "w", encoding="utf-8") as f:
    json.dump(floors, f, ensure_ascii=False, indent=2)
