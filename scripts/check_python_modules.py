import importlib.util,json
mods=['PIL','cv2','pytesseract','numpy','pandas','whisper','faster_whisper','openpyxl','PyPDF2']
print(json.dumps({m: bool(importlib.util.find_spec(m)) for m in mods}, indent=2))
