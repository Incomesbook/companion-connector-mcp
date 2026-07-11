import importlib.util as u
mods=['pygetwindow','pywinctl','win32gui','win32con','pynput','mss','pyautogui','pytesseract','sklearn','sentence_transformers','chromadb','watchdog','pyperclip']
print({m: bool(u.find_spec(m)) for m in mods})
