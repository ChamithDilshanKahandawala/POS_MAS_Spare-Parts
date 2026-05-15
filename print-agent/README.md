# MAS Print Agent

Local HTTP service that bridges the React POS frontend (running in the browser) with the Xprinter XP-Q80B (POS-80C) thermal receipt printer via Windows printer sharing.

---

## Architecture

```
Browser POS (Vercel) ──POST /print──► localhost:9100 ──ESC/POS──► \\DESKTOP-KR9L0QV\POS-80C ──► Printer
```

The agent runs entirely on the shop PC. It has no internet connectivity requirement — once started, it works offline.

---

## Prerequisites

- Node.js **v20 or higher** — download from https://nodejs.org
- The **POS-80C printer** installed and shared in Windows (follow `/docs/PRINTER_SETUP.md`)
- Verify the share works: open PowerShell and run:
  ```powershell
  Test-Path "\\DESKTOP-KR9L0QV\POS-80C"
  # Should return: True
  ```

---

## Installation

```powershell
# Navigate to the print-agent folder
cd "F:\MAS Inventory\POS_MAS_Spare-Parts\print-agent"

# Install dependencies
npm install

# Copy the example env file and configure it
copy .env.example .env
notepad .env
```

### Configure `.env`

```env
AGENT_PORT=9100
WINDOWS_PRINTER_PATH=\\DESKTOP-KR9L0QV\POS-80C
DRAWER_ENABLED=true
ALLOWED_ORIGINS=http://localhost:5173,https://pos-mas-spare-parts-p2tnkruht-chamith-dilshans-projects.vercel.app
```

> **Finding the exact printer path:**  
> Open PowerShell and run:  
> ```powershell
> Get-Printer | Select-Object Name, Shared, ShareName
> ```
> Your path is: `\\` + result of `hostname` + `\` + the ShareName column.

---

## Running (Manual / Test Mode)

```powershell
cd "F:\MAS Inventory\POS_MAS_Spare-Parts\print-agent"
npm start
```

You should see:
```
[INFO ] MAS Print Agent started { port: 9100, printerPath: \\DESKTOP-KR9L0QV\POS-80C }
[INFO ] Endpoints: http://localhost:9100/health | /test | /print | /open-drawer
```

### Test it immediately

Open a browser and go to: **http://localhost:9100/test**

The printer should print a sample receipt. If it does, the agent is working correctly.

---

## Endpoints

| Method | Path            | Description                                 |
|--------|-----------------|---------------------------------------------|
| GET    | `/health`       | Returns status + printer reachability       |
| GET    | `/test`         | Prints a sample test receipt                |
| POST   | `/print`        | Prints a real receipt (body: `{ sale: {} }`) |
| POST   | `/open-drawer`  | Kicks cash drawer (manager use)             |

---

## Installing as a Windows Service (Auto-start on Boot)

Once manual testing works, install as a background service so it starts automatically when the PC boots — no terminal needed.

**Run PowerShell as Administrator:**

```powershell
cd "F:\MAS Inventory\POS_MAS_Spare-Parts\print-agent"
node install-service.js
```

You should see:
```
✅ MAS Print Agent installed as Windows service.
✅ MAS Print Agent is running.
   Test it: http://localhost:9100/health
```

To verify it's running:
```powershell
Get-Service -Name "MAS Print Agent"
# Status should be: Running
```

### Uninstalling the service

```powershell
# Run as Administrator
node uninstall-service.js
```

---

## Logs

- **Console:** visible when running manually with `npm start`
- **Log files:** `print-agent/logs/print-agent-YYYY-MM-DD.log`
- **Windows Event Viewer:** when running as a service, errors also appear in:
  `Event Viewer → Windows Logs → Application` (source: "MAS Print Agent")

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `/health` returns `printerReachable: false` | Printer offline or share broken | Check printer power, USB, and re-run `Test-Path "\\DESKTOP-KR9L0QV\POS-80C"` |
| `ENOENT` or `Access Denied` error | Wrong printer path in `.env` | Run `Get-Printer` to get exact share name |
| Garbled characters print | Wrong printer type | Try `PrinterTypes.STAR` in `src/printer.js` |
| Receipt prints but drawer doesn't open | `DRAWER_ENABLED=false` or RJ11 not plugged in | Set `DRAWER_ENABLED=true` in `.env`, check cable |
| Service won't install | Not running as Administrator | Right-click PowerShell → "Run as administrator" |
| CORS error in browser console | Vercel URL not in `ALLOWED_ORIGINS` | Add the exact URL to `.env` `ALLOWED_ORIGINS` |
