from pathlib import Path
p=Path('src/server.js')
t=p.read_text(encoding='utf-8')
t=t.replace("else if(type==='human_click_xy') result=runLiveBridge('click',{x:action.x,y:action.y,clicks:action.clicks||1},120000);", "else if(type==='human_click_xy') { const loc=action.location||{}; result=runLiveBridge('click',{x:action.x??loc.x,y:action.y??loc.y,clicks:action.clicks||1},120000); }")
t=t.replace("else if(type==='human_mouse_move')", "else if(type==='human_mouse_move')")
p.write_text(t, encoding='utf-8')
print('patched v19 location support')
