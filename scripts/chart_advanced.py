from pathlib import Path
import argparse, json, math
import cv2, numpy as np
from PIL import Image
try:
    import pytesseract
except Exception:
    pytesseract = None

def color_clusters(img, k=6):
    small = cv2.resize(img, (0,0), fx=0.25, fy=0.25)
    data = small.reshape((-1,3)).astype(np.float32)
    _, labels, centers = cv2.kmeans(data, k, None, (cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0), 3, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.flatten(), minlength=k)
    return [{'bgr': [int(x) for x in centers[i]], 'count': int(counts[i])} for i in np.argsort(-counts)]
def line_stats(gray):
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=45, minLineLength=30, maxLineGap=8)
    out = []
    if lines is not None:
        for l in lines[:1000]:
            x1,y1,x2,y2 = [int(v) for v in l[0]]
            length = math.hypot(x2-x1, y2-y1)
            angle = math.degrees(math.atan2(y2-y1, x2-x1))
            out.append({'x1':x1,'y1':y1,'x2':x2,'y2':y2,'length':round(length,2),'angle':round(angle,2)})
    horiz = [l for l in out if abs(l['angle']) < 8 or abs(abs(l['angle'])-180) < 8]
    vert = [l for l in out if abs(abs(l['angle'])-90) < 8]
    diag = [l for l in out if l not in horiz and l not in vert]
    return out, {'horizontal': len(horiz), 'vertical': len(vert), 'diagonal': len(diag)}

def contour_stats(gray):
    _, th = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes=[]
    for c in contours[:2000]:
        x,y,w,h = cv2.boundingRect(c); area=cv2.contourArea(c)
        if area >= 20:
            boxes.append({'x':int(x),'y':int(y),'w':int(w),'h':int(h),'area':float(area)})
    return sorted(boxes, key=lambda b: b['area'], reverse=True)[:200]
def analyze(path: Path):
    img = cv2.imread(str(path))
    if img is None:
        raise ValueError('image_not_readable')
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    lines, counts = line_stats(gray)
    boxes = contour_stats(gray)
    text = ''
    if pytesseract:
        try: text = pytesseract.image_to_string(Image.open(path))
        except Exception as e: text = 'OCR_ERROR: ' + str(e)
    h,w = gray.shape[:2]
    dark = np.where(gray < 80)
    bbox = None
    if len(dark[0]):
        bbox = {'x1': int(dark[1].min()), 'y1': int(dark[0].min()), 'x2': int(dark[1].max()), 'y2': int(dark[0].max())}
    return {'ok': True, 'path': str(path), 'width': w, 'height': h, 'ocrText': text, 'lineCounts': counts, 'linesSample': lines[:100], 'objectBoxes': boxes[:100], 'dominantColors': color_clusters(img), 'plotAreaGuess': bbox}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--path', required=True); args=ap.parse_args()
    try: print(json.dumps(analyze(Path(args.path)), ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({'ok':False,'error':str(e)}, ensure_ascii=False, indent=2)); raise SystemExit(1)
if __name__ == '__main__': main()
