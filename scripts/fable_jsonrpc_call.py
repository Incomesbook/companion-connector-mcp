import json, subprocess, sys, pathlib, os
server = r'J:\Setup_VcCode_Workspace\S21_Shared_VSCode_Runtime\runtime\VSCodePortable\data\user-data\User\mcp-servers\fable5-connector\server.py'
python = r'J:\Setup_VcCode_Workspace\S04_Shared_Connections\S04_03_Shared_Program_Connections\python\.venv\Scripts\python.exe'
prompt = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8') if len(sys.argv)>1 else 'health check OK'
messages = [
    {"jsonrpc":"2.0","id":1,"method":"initialize","params":{}},
    {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"ask_fable5","arguments":{"prompt":prompt}}},
]
stdin='\n'.join(json.dumps(x, ensure_ascii=False) for x in messages)+'\n'
env=os.environ.copy(); env.update({'PYTHONUTF8':'1','PYTHONIOENCODING':'utf-8','LC_ALL':'C.UTF-8','LANG':'C.UTF-8'})
r = subprocess.run([python, server], input=stdin, text=True, encoding='utf-8', errors='replace', capture_output=True, timeout=180, env=env)
print('RET', r.returncode)
print('STDOUT')
print(r.stdout)
print('STDERR')
print(r.stderr)
