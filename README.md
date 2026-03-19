# 🛡️ Yantraraksha Network — Suraksha Sentinel

> **AI-Powered ICS/SCADA Cybersecurity Monitoring System**  
> Real-time threat detection, ML-based anomaly analysis, and automated incident response for Industrial Control Systems.

[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Live Demo Screenshots](#-live-demo-screenshots)
- [System Architecture](#-system-architecture)
- [Data Flow Diagram](#-data-flow-diagram)
- [Attack Response Flow](#-attack-response-flow)
- [Tech Stack](#-tech-stack)
- [ML Models](#-ml-models)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
- [Running the Project](#-running-the-project)
- [Features](#-features)
- [Security Features](#-security-features)
- [Contributing](#-contributing)

---

## 🔍 Overview

**Suraksha Sentinel** is a full-stack ICS cybersecurity dashboard built for the **B1 capstone project**. It monitors industrial networks (PLCs, HMIs, SCADA servers, RTUs) in real-time using ML anomaly detection, maps global threats on a live world map, and enables SOC officers to respond to attacks with one click.

### Key Capabilities

- 🔴 **Real-time attack detection** via ML ensemble (97%+ accuracy)
- 🗺️ **Live global threat map** with Leaflet + CartoDB Dark Matter tiles
- 🔒 **Device quarantine** — isolates compromised PLCs from the network
- 📡 **Live packet monitoring** — packets/sec with attack threshold alerts
- 📋 **Incident report export** — CSV/JSON for SIEM/SOAR integration
- 🛡️ **Automated firewall rules** via Windows `netsh advfirewall`
- 🌗 **Dark/Light theme** toggle

---

## 🖥️ Live Demo Screenshots

| Dashboard (Dark) | ML Engine Tab |
|---|---|
| Real-time KPIs, Threat Map, SCADA Topology | Alert trends, Heatmap, Device Quarantine |

| Alert Feed | Incident Response (SOC) |
|---|---|
| Live Leaflet map + alert list | Attack chain, Affected assets, SOC chat |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         YANTRARAKSHA SENTINEL                           │
│                      ICS Cybersecurity Platform                         │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────┐
  │                        FRONTEND  (React + Vite)                      │
  │                        http://localhost:5173                         │
  │                                                                      │
  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────┐ ┌───────────┐  │
  │  │Dashboard │ │Alert Feed│ │  Incident │ │Device  │ │ML Anomaly │  │
  │  │          │ │          │ │ Response  │ │Registry│ │  Engine   │  │
  │  │ThreatMap │ │ThreatMap │ │SOC Chat   │ │        │ │Charts     │  │
  │  │SCADA Topo│ │Alerts Log│ │Playbook   │ │        │ │Heatmap    │  │
  │  └──────────┘ └──────────┘ └───────────┘ └────────┘ └───────────┘  │
  │                                                                      │
  │        ↕ REST API (fetch)          ↕ WebSocket (ws://)              │
  └──────────────────────────────────────────────────────────────────────┘
                          │                    │
                          ▼                    ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                     BACKEND  (FastAPI + Python)                      │
  │                        http://localhost:8000                         │
  │                                                                      │
  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
  │  │  REST API   │  │  WebSocket   │  │    ML Engine             │   │
  │  │  17 routes  │  │  /ws/alerts  │  │  Isolation Forest v2.1   │   │
  │  │             │  │  Real-time   │  │  Random Forest Binary    │   │
  │  │  /status    │  │  push alerts │  │  Random Forest Multi     │   │
  │  │  /alerts    │  │              │  │  Ensemble (98.92%)       │   │
  │  │  /quarantine│  └──────────────┘  └──────────────────────────┘   │
  │  │  /report    │                                                     │
  │  │  /packets   │  ┌──────────────┐  ┌──────────────────────────┐   │
  │  └─────────────┘  │   Nmap Scan  │  │  Windows Firewall        │   │
  │                   │  192.168.x/24│  │  netsh advfirewall       │   │
  │                   │  Every 30s   │  │  Block/Quarantine IPs    │   │
  │                   └──────────────┘  └──────────────────────────┘   │
  │                                                                      │
  │  ┌──────────────────────────────────────────────────────────────┐   │
  │  │                  IN-MEMORY STATE STORE                       │   │
  │  │  SYSTEM_STATE | ALERT_HISTORY | BLOCKED_IPS                 │   │
  │  │  QUARANTINED_DEVICES | INCIDENT_LOG                         │   │
  └──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                     NETWORK LAYER  (Local WiFi)                      │
  │                                                                      │
  │   PLC-01      HMI-D1     SCADA Server   RTU-01    Engineering WS   │
  │  10.0.0.12   10.0.0.11    10.0.0.x     10.0.0.15    10.0.0.x      │
  │                                                                      │
  │             Nmap scans 192.168.1.0/24 every 30 seconds              │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

```
ATTACK SIMULATOR                    BACKEND                      FRONTEND
(hacker_attack.py)                (FastAPI)                   (React + Vite)
       │                              │                              │
       │  POST /api/v1/trigger-attack │                              │
       │─────────────────────────────▶│                              │
       │                              │                              │
       │                              │── Update SYSTEM_STATE ──────▶│
       │                              │   is_under_attack = True     │
       │                              │   current_threat_ip = X      │
       │                              │                              │
       │                              │── Create ALERT entry ───────▶│
       │                              │   severity = CRITICAL        │
       │                              │   mitre_tag = T0836          │
       │                              │                              │
       │                              │── WebSocket broadcast ──────▶│
       │                              │   type: "alert"              │ Update UI
       │                              │   data: { alert object }     │ Red banner
       │                              │                              │ Flash map
       │                              │                              │
       │              [if auto_respond=ON]                           │
       │                              │                              │
       │                              │── netsh firewall block ──────│
       │                              │── BLOCKED_IPS[ip] = {...}    │
       │                              │── WebSocket broadcast ──────▶│
       │                              │   type: "auto_block"         │ Green banner
       │                              │                              │
       │              [if officer clicks BLOCK]                      │
       │                              │◀─── POST /block-attacker ────│
       │                              │── netsh firewall block       │
       │                              │── blocked_by = "manual"      │
       │                              │── WebSocket broadcast ──────▶│
       │                              │                              │
       │              [3 second poll]                                │
       │                              │◀─── GET /api/v1/status ──────│
       │                              │──── response ───────────────▶│ Update KPIs
       │                              │◀─── GET /api/v1/alerts ──────│
       │                              │──── response ───────────────▶│ Update tables
```

---

## ⚔️ Attack Response Flow

```
                         Attack Detected
                               │
                               ▼
                    ┌─────────────────────┐
                    │  ML Engine Active?  │
                    └─────────────────────┘
                         │         │
                        YES        NO
                         │         │
                         ▼         ▼
              ┌────────────────┐  ┌──────────────────────┐
              │ Confidence     │  │ Alert sent to SOC     │
              │ Score > 95%?   │  │ Officer notified      │
              └────────────────┘  └──────────────────────┘
                   │       │
                  YES       NO
                   │         │
                   ▼         ▼
        ┌──────────────┐  ┌──────────────────────────┐
        │ AUTO-RESPOND │  │ Manual officer response  │
        │ enabled?     │  │ 🛑 BLOCK ATTACKER button  │
        └──────────────┘  └──────────────────────────┘
              │
             YES
              │
              ▼
    ┌───────────────────────┐
    │  Apply firewall rule  │
    │  netsh advfirewall    │
    │  block IP (in+out)    │
    └───────────────────────┘
              │
              ▼
    ┌───────────────────────┐
    │  Broadcast WebSocket  │
    │  type: "auto_block"   │
    │  Dashboard turns GREEN│
    └───────────────────────┘
              │
              ▼
    ┌───────────────────────┐       ┌────────────────────────┐
    │  Device Quarantine    │──────▶│  Block ALL traffic     │
    │  (if lateral movement)│       │  from ICS device IP    │
    └───────────────────────┘       │  in + out firewall rule│
              │                     └────────────────────────┘
              ▼
    ┌───────────────────────┐
    │  Export Incident      │
    │  Report (CSV / JSON)  │
    │  for SIEM / SOAR      │
    └───────────────────────┘
```

---

## 🧰 Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.x | UI component framework |
| **Vite** | 5.x | Dev server + build tool |
| **Leaflet.js** | 1.9.4 | Interactive world threat map |
| **CartoDB Dark Matter** | — | Dark map tiles (free, no API key) |
| **Canvas API** | — | SCADA topology, traffic graph |
| **CSS Variables** | — | Dark/Light theme system |
| **WebSocket** | Native | Real-time alert streaming |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| **Python** | 3.12 | Core language |
| **FastAPI** | 0.111 | REST API + WebSocket server |
| **Uvicorn** | latest | ASGI server |
| **python-nmap** | 0.7.1 | Network host scanning |
| **Nmap** | 7.98 | Actual port/host scanner |
| **Npcap** | 1.83 | Packet capture driver (Windows) |
| **Scapy** | 2.7.0 | Packet crafting/analysis |
| **subprocess** | stdlib | Windows firewall integration |
| **StreamingResponse** | FastAPI | CSV/JSON report export |

### ML & Data Science

| Technology | Version | Purpose |
|---|---|---|
| **scikit-learn** | latest | Random Forest, Isolation Forest |
| **NumPy** | latest | Numerical computation |
| **Pandas** | latest | Data preprocessing |
| **Joblib** | latest | Model serialization (.pkl) |
| **Git LFS** | latest | Large model file storage |

### Infrastructure & Tools

| Technology | Purpose |
|---|---|
| **Windows Firewall (netsh)** | Block/quarantine IPs at OS level |
| **Git + GitHub** | Version control (branch: `b1withmlmodel`) |
| **Git LFS** | Track large ML model files (>50MB) |
| **GitHub Actions** *(planned)* | CI/CD pipeline |

---

## 🤖 ML Models

All 10 models located at `mvp/ml_engine/` — verified PASS on evaluation.

| Model | Type | Accuracy / Precision | File Size | Tracked Via |
|---|---|---|---|---|
| **RF Binary Classifier** | Random Forest | 97.21% accuracy | ~12MB | Git LFS |
| **RF Multi-class Classifier** | Random Forest | 96.33% accuracy | ~18MB | Git LFS |
| **Isolation Forest** | Unsupervised anomaly | 73.71% detection rate | ~8MB | Git LFS |
| **Ensemble Model** | RF + IsoForest combined | **98.92% precision** | ~22MB | Git LFS |
| **Label Encoder** | Preprocessing | — | <1MB | Git |
| **Standard Scaler** | Feature normalization | — | <1MB | Git |
| `rf_binary.pkl` | Serialized RF Binary | — | 12.5MB | Git LFS |
| `rf_multi.pkl` | Serialized RF Multi | — | 18.2MB | Git LFS |
| `isoforest.pkl` | Serialized IsoForest | — | 7.8MB | Git LFS |
| `ensemble.pkl` | Serialized Ensemble | — | 22.1MB | Git LFS |

> ⚠️ Large models (`rf_binary_large.pkl` 72.5MB, `rf_multi_large.pkl` 124.8MB) are excluded from git via `.gitignore`.

### MITRE ATT&CK Mappings

| Attack Type | MITRE Tag | Description |
|---|---|---|
| Modbus Write Injection | **T0836** | Modify Parameter |
| DNP3 Replay Attack | **T0834** | Native API exploitation |
| Port Scan / Discovery | **T0840** | Network Service Scanning |
| Man-in-the-Middle | **T0830** | Adversary-in-the-Middle |
| DDoS Flood Attack | **T0814** | Denial of Service |
| Auto-Block Response | **T0800** | Activate/Deactivate Equipment |
| Device Quarantine | **T0816** | Device Restart/Shutdown |

---

## 📡 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/status` | System state, ML metrics, packet counter |
| `GET` | `/api/v1/alerts` | Full alert history |
| `GET` | `/api/v1/devices` | Device list with ROGUE/BLOCKED/QUARANTINED status |
| `GET` | `/api/v1/incident-details` | Modbus protocol info + playbook steps |
| `POST` | `/api/v1/trigger-attack` | Simulate an attack (demo) |
| `POST` | `/api/v1/block-attacker` | Manual firewall block |
| `POST` | `/api/v1/ml-control` | start / stop / auto_on / auto_off |
| `GET` | `/api/v1/blocked-ips` | List all blocked IPs |
| `POST` | `/api/v1/unblock` | Remove firewall block |
| `POST` | `/api/v1/reset` | Full system reset |
| `POST` | `/api/v1/soft-reset` | Clear attack state only (keep history) |

### New Features (v2)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/quarantine` | Isolate a device (block all traffic in+out) |
| `POST` | `/api/v1/quarantine/release` | Release device from quarantine |
| `GET` | `/api/v1/quarantine` | List all quarantined devices |
| `POST` | `/api/v1/packets/update` | Update live packet counter |
| `GET` | `/api/v1/packets` | Get current packet stats |
| `GET` | `/api/v1/report/csv` | Export incident report as CSV |
| `GET` | `/api/v1/report/json` | Export incident report as JSON |

### WebSocket

| Endpoint | Event Types |
|---|---|
| `ws://localhost:8000/ws/alerts` | `alert`, `auto_block`, `attacker_blocked`, `device_quarantined`, `packet_update`, `ml_status` |

---

## 📁 Project Structure

```
Suraksha-Project/
│
├── backend/
│   ├── main.py                  # FastAPI app — all 17 API routes
│   └── __pycache__/
│
├── frontend/
│   └── frontend/
│       ├── src/
│       │   ├── App.jsx          # Main app — all tabs, state, routing
│       │   ├── App.css          # Dark/Light theme CSS variables
│       │   ├── ThreatMap.jsx    # Leaflet world map with attack arcs
│       │   ├── MLEngineTab.jsx  # Charts, heatmap, quarantine, export
│       │   ├── LoginPage.jsx    # Authentication screen
│       │   └── services/
│       │       └── apiClient.js # REST + WebSocket API wrapper
│       ├── package.json
│       └── vite.config.js
│
├── hacker_attack.py             # Attack simulator (5 attack types)
├── .gitignore
├── .gitattributes               # Git LFS tracking rules
└── README.md
```

### ML Engine (separate repo / folder)

```
mvp/ml_engine/
├── rf_binary.pkl                # Random Forest Binary (12.5MB)
├── rf_multi.pkl                 # Random Forest Multi-class (18.2MB)
├── isoforest.pkl                # Isolation Forest (7.8MB)
├── ensemble.pkl                 # Ensemble model (22.1MB)
├── label_encoder.pkl            # Label encoder
└── scaler.pkl                   # Standard scaler
```

---

## ⚙️ Setup & Installation

### Prerequisites

| Requirement | Version | Link |
|---|---|---|
| Python | 3.10+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Nmap | 7.98 | [nmap.org](https://nmap.org) |
| Npcap | 1.83 | [npcap.com](https://npcap.com) |
| Git LFS | latest | [git-lfs.com](https://git-lfs.github.com) |

### 1. Clone the repository

```bash
git clone https://github.com/touh2004/Suraksha-Project.git
cd Suraksha-Project
git checkout b1withmlmodel
```

### 2. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Install dependencies
pip install fastapi uvicorn python-nmap scapy scikit-learn numpy pandas joblib
```

### 3. Frontend setup

```bash
cd frontend/frontend
npm install
```

### 4. Verify Nmap is installed

```bash
nmap --version
# Should show: Nmap version 7.98
```

---

## 🚀 Running the Project

### Terminal 1 — Start Backend

```powershell
cd "C:\Users\soumy\OneDrive\Desktop\B1\Suraksha-Project\backend"
uvicorn main:app --reload --port 8000
```

API docs available at: `http://localhost:8000/docs`

### Terminal 2 — Start Frontend

```powershell
cd "C:\Users\soumy\OneDrive\Desktop\B1\Suraksha-Project\frontend\frontend"
npm run dev
```

Dashboard available at: `http://localhost:5173`

### Terminal 3 — Simulate an Attack (optional)

```powershell
cd "C:\Users\soumy\OneDrive\Desktop\B1\Suraksha-Project"
python hacker_attack.py
```

### Login Credentials (Demo)

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | SOC Analyst |
| `officer` | `officer123` | Security Officer |

---

## ✨ Features

### Dashboard Tab
- Live KPI cards — Machines Online, Network Status, Active Alerts
- Animated dual-wave traffic graph (canvas)
- SCADA network topology with radar sweep animation
- Real-time threat map (Leaflet + CartoDB Dark tiles)
- AI Threat Detection panel with ML confidence bar
- Attack Timeline table with MITRE tags

### Alert Feed Tab
- Global threat map showing attacker countries with arc lines
- Live network traffic graph
- Alert feed with severity pills and MITRE ATT&CK tags

### Incident Response (SOC) Tab
- Critical incident banner with live timer
- Attack chain progress (4 stages)
- Affected assets table (PLC-01, HMI-D1, SCADA-Server, etc.)
- Response playbook with assigned officers
- SOC communication chat panel

### Device Registry Tab
- Live device list from Nmap scan
- Status badges: ONLINE / COMPROMISED / QUARANTINED / ROGUE

### ML Anomaly Engine Tab
- Alert volume trend line chart (1D/1W/2W/1M)
- Threats coverage radar chart (8 MITRE categories)
- Severity distribution donut chart
- Weekly threat activity heatmap
- ML engine controls (Start/Stop, Auto-Respond toggle)
- **🆕 Real-time Packet Monitor** — live pps with baseline comparison
- **🆕 Device Quarantine** — isolate/release ICS devices
- **🆕 Export Incident Report** — CSV and JSON download

---

## 🔐 Security Features

| Feature | Implementation | Industry Standard |
|---|---|---|
| IP Blocking | Windows `netsh advfirewall` | ✅ NIST SP 800-82 |
| Device Quarantine | Firewall block in+out per device IP | ✅ IEC 62443 |
| Anomaly Detection | Isolation Forest + Random Forest ensemble | ✅ ISA/IEC 62443-3-3 |
| MITRE Mapping | ATT&CK for ICS framework | ✅ Industry standard |
| Incident Logging | Timestamped event log → CSV/JSON export | ✅ SOC compliance |
| Auto-Response | ML confidence threshold (>95%) triggers block | ✅ SOAR pattern |
| Role-based Access | Admin / Security Officer roles | ✅ RBAC |

---

## 🔄 Attack Types Simulated

| Attack | Protocol | MITRE | Target | Attacker IP |
|---|---|---|---|---|
| Modbus Write Injection | Modbus TCP / Port 502 | T0836 | PLC-01 | 45.33.32.156 (USA) |
| DNP3 Replay Attack | DNP3 / Port 20000 | T0834 | RTU-01 | 192.168.1.99 (Russia) |
| Port Scan / Discovery | TCP SYN | T0840 | All devices | 10.10.10.55 (China) |
| Man-in-the-Middle | ARP Spoofing | T0830 | HMI-D1 | 77.88.55.22 (Germany) |
| DDoS Flood Attack | UDP Flood | T0814 | SCADA Server | 185.220.101.1 (UK) |

---

## 🌐 Deployment Notes

> ⚠️ **Nmap scanning is local-only** — it scans your actual WiFi subnet (`192.168.1.0/24`). This will NOT work after cloud deployment. The rest of the dashboard works in demo/simulation mode without Nmap.

For cloud deployment (planned):
- Replace Nmap scan with simulated device data
- Replace Windows Firewall calls with cloud WAF API
- Add a proper database (PostgreSQL/SQLite) to persist alerts

---

## 🤝 Contributing

```
Branch: b1withmlmodel
Remote: origin  → https://github.com/touh2004/Suraksha-Project
Remote: yantraraksha → https://github.com/Mysteriousboy727/Yantraraksha-Network.git
```

```bash
# Push to primary remote
git add .
git commit -m "feat: your feature description"
git push origin main

# Push to Yantraraksha remote
git push yantraraksha HEAD:main --force
```

---

## 👥 Team

**Project:** Suraksha Sentinel / Yantraraksha Network  
**Branch:** B1 Capstone  
**Institution:** ICS Cybersecurity Lab

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <strong>Built with ❤️ for ICS Security</strong><br/>
  <sub>Protecting Industrial Control Systems with AI-powered threat detection</sub>
</div>
