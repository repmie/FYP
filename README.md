# ZarahSense

**Academic air-quality monitoring and forecasting web application for the Klang Valley.**

ZarahSense combines hourly OpenAQ measurements with a Random Forest model to show PM2.5-based AQI readings and forecasts for five monitoring stations.

> **Disclaimer:** This is a final-year university project and is not official health advice. Follow guidance from Malaysia's Department of Environment and your doctor for health decisions.

---

## Table of Contents

1. [Project at a Glance](#1-project-at-a-glance)
2. [Features](#2-features)
3. [Tech Stack and Code Labels](#3-tech-stack-and-code-labels)
4. [How It Works](#4-how-it-works)
5. [Project Layout](#5-project-layout)
6. [Requirements](#6-requirements)
7. [Setup](#7-setup)
8. [Environment Variables](#8-environment-variables)
9. [API Overview](#9-api-overview)
10. [Monitoring Stations](#10-monitoring-stations)
11. [Retraining the Model](#11-retraining-the-model)
12. [Troubleshooting](#12-troubleshooting)
13. [Known Limitations](#13-known-limitations)
14. [Data Sources and Credits](#14-data-sources-and-credits)

---

## 1. Project at a Glance

| Label | Detail |
| --- | --- |
| **Project type** | Final-year university project (academic) |
| **Domain** | Air-quality monitoring and forecasting |
| **Region** | Klang Valley, Malaysia |
| **Stations** | 5 |
| **Pollutant used for AQI** | PM2.5 only |
| **Forecast range** | Up to 24 hours ahead |
| **Model** | Random Forest (scikit-learn) |
| **Live data source** | OpenAQ API |
| **Backend** | Python, FastAPI (port `8000`) |
| **Frontend** | React, Vite (port `5173`) |
| **Chatbot** | Gemini free tier (optional, 18+ only) |

---

## 2. Features

| Label | Feature | Description |
| --- | --- | --- |
| `[Monitor]` | Current readings | Latest air-quality readings and station status |
| `[Dashboard]` | Home dashboard | Current readings, map-based forecast browsing, and up to 24-hour forecast insights with uncertainty ranges |
| `[Forecast]` | What-if forecasts | Forecasts using adjusted sensor inputs |
| `[Analysis]` | Accuracy and correlation | Model accuracy and historical correlation views |
| `[Chatbot]` | FYP assistant | An FYP-only chatbot powered by the Gemini free tier |
| `[Download]` | Reports | Downloadable dataset and model reports |
| `[Data]` | Live data with fallback | Live readings from OpenAQ, with dataset readings used for current conditions when live data is unavailable |

---

## 3. Tech Stack and Code Labels

Every language, framework, and library used in this project, labelled by role.

### 3.1 Languages

| Label | Language | Used for |
| --- | --- | --- |
| `[Python]` | Python 3.10+ | Backend API, forecasting engine, OpenAQ client, model training |
| `[JavaScript]` | JavaScript (Node.js) | Frontend application and Vite configuration |
| `[PowerShell]` | PowerShell | Setup and run commands on Windows |

### 3.2 Backend Libraries

| Label | Library | Used for |
| --- | --- | --- |
| `[API]` | FastAPI | REST API framework (`backend/server.py`) |
| `[Server]` | Uvicorn | ASGI server that runs the FastAPI app |
| `[Math]` | NumPy | Numerical operations |
| `[Data]` | pandas | Reading and preparing hourly datasets |
| `[ML]` | scikit-learn | Random Forest model training and prediction |
| `[ML]` | joblib | Saving and loading model files (`rf_model.joblib`) |
| `[Config]` | python-dotenv | Loading secrets from `backend/.env` |

### 3.3 Frontend

| Label | Tool | Used for |
| --- | --- | --- |
| `[UI]` | React | User interface (`frontend/src/`) |
| `[Build]` | Vite | Development server and bundler (`frontend/vite.config.mjs`) |
| `[Package]` | npm | Installing and running frontend dependencies |

### 3.4 External Services

| Label | Service | Used for |
| --- | --- | --- |
| `[Data]` | OpenAQ | Live hourly air-quality measurements |
| `[AI]` | Google Gemini (free tier) | FYP-only chatbot |

### 3.5 Code-to-File Map

| Label | File | What the code does |
| --- | --- | --- |
| `[Backend]` | `backend/server.py` | FastAPI application and all API routes |
| `[Backend]` | `backend/engine.py` | Forecast and AQI calculations |
| `[Backend]` | `backend/openaq.py` | OpenAQ data access |
| `[ML]` | `backend/scripts/train.py` | Model retraining and accuracy report generation |
| `[Data]` | `backend/data/` | Dataset, model artifacts, and accuracy reports |
| `[Frontend]` | `frontend/src/` | React application |
| `[Config]` | `frontend/vite.config.mjs` | Vite configuration |
| `[Config]` | `backend/.env` | Secret keys (never commit this file) |

---

## 4. How It Works

```text
OpenAQ API ──► backend/openaq.py ──► backend/engine.py ──► backend/server.py ──► React frontend
 (hourly data)   (fetch readings)     (forecast + AQI)       (FastAPI /api)       (dashboard, charts, chat)
                                            ▲
                                  Random Forest model
                              (backend/data/rf_model.joblib)
```

### 4.1 Model Inputs

The forecast needs **24 consecutive hourly readings** for all five inputs:

| Label | Input |
| --- | --- |
| `[Input 1]` | PM1 |
| `[Input 2]` | PM2.5 |
| `[Input 3]` | Relative humidity |
| `[Input 4]` | Temperature |
| `[Input 5]` | PM0.3 particle count |

### 4.2 Forecast Behaviour

| Label | Situation | Result |
| --- | --- | --- |
| `[Normal]` | 24 complete hourly readings available | Full model forecast up to 24 hours ahead |
| `[Limited]` | Recent complete readings are missing | Forecast may be limited |
| `[Fallback]` | Model forecast is not possible | A clearly labelled persistence fallback may be used |
| `[Offline]` | Live OpenAQ data unavailable | Dataset readings are used for current conditions |

### 4.3 AQI Calculation

AQI is calculated from **PM2.5 only**. Other pollutants are not included.

---

## 5. Project Layout

```text
zarahsense/
├── backend/
│   ├── data/                 # Dataset, model artifacts, and accuracy reports
│   ├── scripts/train.py      # Model retraining and accuracy report generation
│   ├── engine.py             # Forecast and AQI calculations
│   ├── openaq.py             # OpenAQ data access
│   └── server.py             # FastAPI application
├── frontend/
│   ├── src/                  # React application
│   └── vite.config.mjs
└── package.json
```

---

## 6. Requirements

| Label | Requirement | Notes |
| --- | --- | --- |
| `[Required]` | Node.js and npm | For the frontend |
| `[Required]` | Python 3.10 or newer | For the backend |
| `[Recommended]` | OpenAQ API key | Needed for live readings |
| `[Optional]` | Gemini API key | Needed only for the chatbot |

---

## 7. Setup

### Step 1: Configure OpenAQ

**Label:** `[Config]` · **File:** `backend/.env`

Create or update `backend/.env`:

```dotenv
OPENAQ_API_KEY=your_openaq_api_key
```

Do not commit API keys or other secrets. The backend can still start without a key, but live OpenAQ requests will be unavailable.

### Step 2 (Optional): Configure the FYP Chatbot

**Label:** `[Config]` · **File:** `backend/.env`

The chatbot uses Google's Gemini 3.5 Flash-Lite free tier. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey) and add it to `backend/.env`:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
```

**Chatbot rules and privacy notes**

| Label | Note |
| --- | --- |
| `[Security]` | The key stays on the backend. Never put it in frontend code or commit it. |
| `[Age]` | Users must confirm they are 18 or older, as required by Google's Gemini API terms. |
| `[Scope]` | The chatbot is grounded in the project's stations, sensor inputs, forecasting and evaluation methods, app pages, API, and known limitations. It should state clearly when a project decision is not documented. |
| `[Style]` | Replies are intended to be concise, plain-language, and in the user's language. |
| `[Privacy]` | Chat messages and recent conversation turns are sent to Google, but live station readings are not. Google may use prompts to improve its products and have them reviewed by humans. Do not enter personal or sensitive information. |
| `[Quota]` | The free tier has usage limits. When free quota is exhausted, chat stops instead of switching to a paid model. |
| `[Billing]` | To avoid charges, use a Google Cloud project with billing disabled and do not upgrade it. |
| `[Disabled]` | If no key is configured, chat is unavailable. |

### Step 3: Install and Start the Backend

**Label:** `[PowerShell]` · **Where:** project root (`zarahsense/`)

Create and activate a virtual environment, then install the backend packages:

```powershell
py -m venv backend\venv
.\backend\venv\Scripts\Activate.ps1
python -m pip install fastapi uvicorn numpy pandas python-dotenv joblib scikit-learn
```

**Label:** `[PowerShell]` · **Where:** `backend/` directory

Start the API from the backend directory so its local modules and data files resolve correctly:

```powershell
Set-Location backend
python server.py
```

| Label | URL |
| --- | --- |
| `[API]` | `http://localhost:8000` |
| `[Docs]` | `http://localhost:8000/docs` (interactive API documentation) |

### Step 4: Install and Start the Frontend

**Label:** `[PowerShell]` · **Where:** project root, in a second terminal

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal (typically `http://localhost:5173`).

**Optional: use another backend URL**

**Label:** `[Config]` · **File:** `frontend/.env`

The frontend defaults to the API at `http://localhost:8000`. To change it, set `VITE_BACKEND_URL`:

```dotenv
VITE_BACKEND_URL=http://localhost:8000
```

Restart the Vite server after changing environment variables.

### Quick Start Summary

| Order | Label | Action | Terminal |
| --- | --- | --- | --- |
| 1 | `[Config]` | Add `OPENAQ_API_KEY` to `backend/.env` | None |
| 2 | `[Backend]` | Activate venv, install packages, run `python server.py` | Terminal 1 |
| 3 | `[Frontend]` | Run `npm install` then `npm run dev` | Terminal 2 |
| 4 | `[Browser]` | Open `http://localhost:5173` | None |

---

## 8. Environment Variables

| Label | Variable | File | Required | Purpose |
| --- | --- | --- | --- | --- |
| `[Backend]` | `OPENAQ_API_KEY` | `backend/.env` | Recommended | Enables live OpenAQ readings |
| `[Backend]` | `GEMINI_API_KEY` | `backend/.env` | Optional | Enables the FYP chatbot |
| `[Frontend]` | `VITE_BACKEND_URL` | `frontend/.env` | Optional | Overrides the backend URL (default `http://localhost:8000`) |

---

## 9. API Overview

All endpoints are prefixed with `/api`.

| Label | Method | Endpoint | Description |
| --- | --- | --- | --- |
| `[Stations]` | `GET` | `/stations` | Station locations and live-data status |
| `[Current]` | `GET` | `/current/{station_id}` | Latest available reading and PM2.5 NowCast |
| `[Forecast]` | `GET` | `/forecast/{station_id}` | Forecast up to 24 hours ahead |
| `[What-if]` | `POST` | `/whatif/{station_id}` | Forecast with optional sensor-value overrides |
| `[Accuracy]` | `GET` | `/accuracy/{station_id}?horizon=1` | Accuracy metrics for a forecast horizon |
| `[Analysis]` | `GET` | `/correlation` | Correlation data for measured inputs |
| `[Chatbot]` | `POST` | `/chat` | Ask a project-scoped question using the Gemini free tier |
| `[Model]` | `GET` | `/model` | Model and input-feature information |
| `[Files]` | `GET` | `/files` | Available downloadable data and reports |

**Label:** `[Example]` · **Language:** PowerShell

```powershell
curl http://localhost:8000/api/stations
```

---

## 10. Monitoring Stations

| Label | Station ID | Notes |
| --- | --- | --- |
| `[Station 1]` | `setia-eco` | |
| `[Station 2]` | `ttdi` | |
| `[Station 3]` | `sejati` | |
| `[Station 4]` | `klcc` | |
| `[Station 5]` | `enviro-exceltech` | Uses the `ENVIRO_EXCELTECH_SDN_BHD` dataset and model records |

---

## 11. Retraining the Model

The checked-in model artifacts are used by default.

**Label:** `[ML]` · **Language:** PowerShell · **Purpose:** retrain the model and regenerate the accuracy report

Run from the project directory with the backend dependencies installed:

```powershell
python backend\scripts\train.py
```

This updates files under `backend/data/`, including `rf_model.joblib` and `accuracy.json`.

**Label:** `[ML]` · **Language:** PowerShell · **Purpose:** regenerate the accuracy report only (no retraining, model artifacts unchanged)

```powershell
python backend\scripts\train.py --evaluate-only
```

| Label | Command | Retrains model | Updates accuracy report |
| --- | --- | --- | --- |
| `[Full]` | `python backend\scripts\train.py` | Yes | Yes |
| `[Evaluate]` | `python backend\scripts\train.py --evaluate-only` | No | Yes |

---

## 12. Troubleshooting

| Label | Problem | Likely cause and fix |
| --- | --- | --- |
| `[Backend]` | Live readings are not showing | `OPENAQ_API_KEY` is missing or invalid. Check `backend/.env`. The app falls back to dataset readings. |
| `[Backend]` | Data or model files not found | Start the server from inside the `backend/` directory (`Set-Location backend`). |
| `[Backend]` | Forecast is limited or marked as fallback | Fewer than 24 consecutive complete hourly readings are available for the five inputs. |
| `[Frontend]` | Frontend cannot reach the API | Confirm the backend is running on port `8000`, or check `VITE_BACKEND_URL`. |
| `[Frontend]` | Changed `.env` but nothing happened | Restart the Vite server after editing environment variables. |
| `[Chatbot]` | Chat is unavailable | `GEMINI_API_KEY` is not set, or the free quota is exhausted. |
| `[Shell]` | PowerShell blocks `Activate.ps1` | Script execution may be restricted by your PowerShell execution policy. Adjust it for your user account, or activate the environment using another method. |

---

## 13. Known Limitations

| Label | Limitation |
| --- | --- |
| `[Scope]` | AQI is based on PM2.5 only. Other pollutants are not included. |
| `[Input]` | Forecasts need 24 consecutive hourly readings for all five inputs. |
| `[Fallback]` | Persistence fallback forecasts are less informative than model forecasts. |
| `[Chatbot]` | Free-tier usage limits apply, and the chatbot is restricted to project questions. |
| `[Health]` | Not official health advice. |
| `[Academic]` | Built as a university project, not a production system. |

---

## 14. Data Sources and Credits

| Label | Source | Used for |
| --- | --- | --- |
| `[Data]` | [OpenAQ](https://openaq.org) | Live hourly air-quality readings |
| `[AI]` | [Google AI Studio / Gemini API](https://aistudio.google.com/apikey) | FYP chatbot |
| `[Guidance]` | Malaysia's Department of Environment | Official health and air-quality guidance |

**Author:** _Add your name here_
**Institution:** _Add your university here_
**Licence:** _Add a licence here if you plan to publish the repository_
