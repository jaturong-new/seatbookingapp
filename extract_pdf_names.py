import subprocess
import xml.etree.ElementTree as ET
import re

pdf_path = "/home/deku/Downloads/Mobile Office 2025-V2 - ผังที่นั่ง-กพ.2026.pdf"
subprocess.run(["pdftotext", "-bbox", pdf_path, "output.html"])

with open("output.html", "r", encoding="utf-8") as f:
    xml_data = f.read()

# Fix unescaped ampersands and namespaces in HTML before parsing
xml_data = xml_data.replace("&", "&amp;")
xml_data = re.sub(r' xmlns="[^"]+"', '', xml_data)

try:
    root = ET.fromstring(xml_data)
except Exception as e:
    print("Error parsing XML:", e)
    import sys
    sys.exit(1)

# F5 is likely page 1, but we can look for "F5" strings
for page in root.findall(".//page"):
    texts = []
    has_f5 = False
    for word in page.findall(".//word"):
        if word.text and "F5-" in word.text:
            has_f5 = True
        if word.text:
            xMin = float(word.get("xMin"))
            yMin = float(word.get("yMin"))
            texts.append((word.text, xMin, yMin))
    
    if has_f5:
        print(f"Found F5 on page {page.get('number')}")
        # Sort by yMin, then xMin
        texts.sort(key=lambda x: (round(x[2]/15)*15, x[1]))
        for t in texts:
            # Print strings that might be names (Thai characters) or F5 codes
            if re.search(r'[ก-๙]', t[0]) or t[0].startswith("F5-") or "Bar" in t[0]:
                print(f"Text: {t[0]:<20} X: {t[1]:.1f} Y: {t[2]:.1f}")
