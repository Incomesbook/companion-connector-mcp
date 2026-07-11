from pathlib import Path
import zipfile, json, csv
root = Path('results/v14_test_assets'); root.mkdir(parents=True, exist_ok=True)
(root/'sample.txt').write_text('Hello V14 document bridge\nLink https://example.com/a.png\n', encoding='utf-8')
with (root/'sample.csv').open('w', newline='', encoding='utf-8') as f:
    w=csv.writer(f); w.writerow(['name','value']); w.writerow(['alpha',1]); w.writerow(['beta',2])
with zipfile.ZipFile(root/'sample.docx','w') as z:
    z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>')
    z.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX V14 content</w:t></w:r></w:p></w:body></w:document>')
with zipfile.ZipFile(root/'sample.pptx','w') as z:
    z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>')
    z.writestr('ppt/slides/slide1.xml','<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>PPTX V14 slide text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>')
try:
    import openpyxl
    wb=openpyxl.Workbook(); ws=wb.active; ws.title='Data'; ws.append(['symbol','price']); ws.append(['AAPL',123]); ws.append(['MSFT',456]); wb.save(root/'sample.xlsx')
except Exception:
    (root/'sample.xlsx').write_text('xlsx unavailable', encoding='utf-8')
with zipfile.ZipFile(root/'sample.zip','w') as z:
    z.write(root/'sample.txt','sample.txt'); z.write(root/'sample.csv','sample.csv')
print(json.dumps({ 'root': str(root.resolve()), 'files': [str(p.resolve()) for p in root.iterdir()] }, indent=2))
