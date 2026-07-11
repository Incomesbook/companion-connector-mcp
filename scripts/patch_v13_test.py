from pathlib import Path
p=Path('scripts/v13-media-test.js')
t=p.read_text(encoding='utf-8')
old="checks.push(unwrap(await post('tools/call',{name:'extract_audio_track',arguments:{media:video}})));"
new=old+"\nchecks.push(unwrap(await post('tools/call',{name:'transcribe_media_audio',arguments:{media:video,model:'tiny'}})));"
if 'transcribe_media_audio' not in t:
    t=t.replace(old,new)
t=t.replace('const ok = checks.length===6','const ok = checks.length===7')
t=t.replace('checks[3].structuredContent.ok && checks[5].structuredContent.count>=2','checks[3].structuredContent.ok && checks[4].structuredContent.ok && checks[6].structuredContent.count>=2')
t=t.replace('ocrChars:checks[3].structuredContent.chars','transcriptOk:checks[3].structuredContent.ok,ocrChars:checks[4].structuredContent.chars')
t=t.replace('chart:checks[4].structuredContent.lineCounts,links:checks[5].structuredContent.count','chart:checks[5].structuredContent.lineCounts,links:checks[6].structuredContent.count')
p.write_text(t,encoding='utf-8')
print('patched v13 test')
