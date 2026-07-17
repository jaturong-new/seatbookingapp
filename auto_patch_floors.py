import json
import re

with open("floors_data.json", "r", encoding="utf-8") as f:
    floors = json.load(f)

def clean_name(texts):
    name = " ".join(texts).strip()
    name = name.replace("", "์").replace("", "๊").replace("", "๊").replace("", "๋")
    name = name.replace("ปญ", "ปัญ").replace("นุน", "นุ่น").replace("เจง", "เจ๋ง")
    name = name.replace("", "้").replace("", "่").replace("", "ึ")
    return name

def auto_patch_floor(floor_code, items):
    seats = []
    names = []
    
    for item in items:
        text = item["text"]
        x, y = item["x"], item["y"]
        if text.startswith(f"{floor_code}-"):
            seats.append({"code": text, "x": x, "y": y})
        elif "Bar" in text or "ประตู" in text:
            seats.append({"code": text, "x": x, "y": y})
        elif re.search(r'[ก-๙]', text) and not ("หอง" in text or "ลาพัก" in text or "จํานวน" in text or "ฝาย" in text or "หมายเหตุ" in text or "ลานจอด" in text or "ไมมี" in text or "เครื่อง" in text or "ตุลาคม" in text):
            names.append({"code": text, "x": x, "y": y})
            
    all_elements = seats + names
    if not all_elements:
        return {}

    # Cluster Y using complete linkage (distance to first element)
    y_vals = sorted(list(set(e["y"] for e in all_elements)))
    rows = []
    for y in y_vals:
        if not rows or y - rows[-1][0] > 20: # Max height of a row cluster is 20
            rows.append([y])
        else:
            rows[-1].append(y)
    
    # Map each y to its row index
    y_to_r = {}
    for r_idx, r_group in enumerate(rows):
        for y in r_group:
            y_to_r[y] = r_idx

    # Cluster X
    x_vals = sorted(list(set(e["x"] for e in all_elements)))
    cols = []
    for x in x_vals:
        if not cols or x - cols[-1][0] > 25: # Max width of an x cluster
            cols.append([x])
        else:
            cols[-1].append(x)
            
    x_to_c = {}
    for c_idx, c_group in enumerate(cols):
        for x in c_group:
            x_to_c[x] = c_idx
            
    layout = {}
    grid_cells = {}
    
    # Map elements to grid
    for e in all_elements:
        r_idx = y_to_r[e["y"]]
        c_idx = x_to_c[e["x"]]
        cell = (r_idx, c_idx)
        if cell not in grid_cells:
            grid_cells[cell] = []
        grid_cells[cell].append(e)

    # Process grid cells
    for cell, elements in grid_cells.items():
        r_idx, c_idx = cell
        
        seat_elements = [e for e in elements if e["code"].startswith(f"{floor_code}-") or "Bar" in e["code"] or "ประตู" in e["code"]]
        name_elements = [e for e in elements if e not in seat_elements]
        
        name_elements.sort(key=lambda e: e["y"])
        
        if seat_elements:
            layout[seat_elements[0]["code"]] = (r_idx, c_idx)
        
        if name_elements:
            name_str = clean_name([e["code"] for e in name_elements])
            layout[name_str] = (r_idx, c_idx)

    # Normalize layout to ensure empty rows/cols are preserved properly if needed, 
    # but the grid indices already do this relative to each other!
    return layout

new_layouts = {}
for fc in ["F24", "F32"]:
    if fc in floors:
        new_layouts[fc] = auto_patch_floor(fc, floors[fc])

with open("data/seed.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for floor_code, layout in new_layouts.items():
    if not layout: continue
    
    seen_codes = set()
    
    for seat in data["seats"]:
        if seat["floor_code"] == floor_code:
            full_code = seat["full_code"]
            if full_code in layout:
                row, col = layout[full_code]
                seat["grid_row"] = row
                seat["grid_col"] = col
                seen_codes.add(full_code)

    data["seats"] = [
        seat for seat in data["seats"] 
        if seat["floor_code"] != floor_code or seat["full_code"] in layout
    ]

    for full_code, (row, col) in layout.items():
        if full_code not in seen_codes:
            code = full_code if not full_code.startswith(f"{floor_code}-") else full_code.split("-")[1]
            new_seat = {
                "floor_code": floor_code,
                "row_letter": "FIXED",
                "col_number": 0,
                "code": code,
                "full_code": full_code,
                "grid_row": row,
                "grid_col": col
            }
            data["seats"].append(new_seat)

with open("data/seed.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Automated patching with better clustering complete.")
