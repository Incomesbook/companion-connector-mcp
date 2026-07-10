# OpenAI Tunnel setup for Companion Connector

This app is designed to be used from ChatGPT New App with **Tunnel**.

You need two values from OpenAI Platform:

1. `CONTROL_PLANE_TUNNEL_ID` from Platform → Settings → Organization → Tunnels → Create tunnel.
2. `CONTROL_PLANE_API_KEY` from Platform runtime API keys with tunnel use permission.

Do not commit keys. The runtime script asks for the key and stores it only in the current process environment.

## Start everything

```powershell
.\scripts\start-companion-with-openai-tunnel.ps1
```

The script will:

- start the local Companion Connector on `127.0.0.1:8788/mcp` if needed;
- create a runtime tunnel profile under `profiles/runtime/`;
- run `tunnel-client doctor`;
- start `tunnel-client run`;
- expose admin UI on `127.0.0.1:8789`.

Then return to ChatGPT New App → Tunnel, refresh the tunnel list, select the tunnel, choose No Auth/OAuth according to UI, check the warning box, and Create.
