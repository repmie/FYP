# ZarahSense

ZarahSense is an academic air-quality monitoring and forecasting web application for five stations in the Klang Valley. It combines hourly OpenAQ measurements with a Random Forest model to show PM2.5-based AQI readings and forecasts.

> **Disclaimer:** This is a final-year university project and is not official health advice. Follow guidance from Malaysia's Department of Environment and your doctor for health decisions.

## Features

- Current air-quality readings and station status
- Home dashboard combining current readings, map-based forecast browsing, and up to 24-hour forecast insights with uncertainty ranges
- What-if forecasts using adjusted sensor inputs
- Model accuracy and historical correlation views
- An FYP-only chatbot powered by the Gemini free tier
- Downloadable dataset and model reports
- Live readings from OpenAQ, with dataset readings used for current conditions when live data is unavailable

The model forecast requires 24 consecutive hourly readings for all five inputs: PM1, PM2.5, relative humidity, temperature, and PM0.3 particle count. If recent complete readings are unavailable, the forecast may be limited or use a clearly labelled persistence fallback. AQI is calculated from PM2.5 only; other pollutants are not included.

## Project layout

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

## Requirements

- Node.js and npm
- Python 3.10 or newer
- An OpenAQ API key for live readings

## Setup

### 1. Configure OpenAQ

Create or update `backend/.env`:

```dotenv
OPENAQ_API_KEY=your_openaq_api_key
```

Do not commit API keys or other secrets. The backend can still start without a key, but live OpenAQ requests will be unavailable.

### Configure the FYP chatbot (optional)

The chatbot uses Google's Gemini 3.5 Flash-Lite free tier. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey) and add it to `backend/.env`:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
```

The key stays on the backend; never put it in frontend code or commit it. The chatbot requires users to confirm they are 18 or older, as required by Google's Gemini API terms. It is grounded in the project's stations, sensor inputs, forecasting and evaluation methods, app pages, API, and known limitations; it should state clearly when a project decision is not documented. Replies are intended to be concise, plain-language, and in the user's language. The free tier has usage limits, and Google may use prompts to improve its products and have them reviewed by humans. Chat messages and recent conversation turns are sent to Google, but live station readings are not. Do not enter personal or sensitive information. To avoid charges, use a Google Cloud project with billing disabled and do not upgrade it; when free quota is exhausted, chat stops instead of switching to a paid model. If no key is configured, chat is unavailable.

### 2. Install and start the backend

From the `zarahsense` project directory, create and activate a Python virtual environment, then install the backend packages:

```powershell
py -m venv backend\venv
.\backend\venv\Scripts\Activate.ps1
python -m pip install fastapi uvicorn numpy pandas python-dotenv joblib scikit-learn
```

Start the API from the backend directory so its local modules and data files resolve correctly:

```powershell
Set-Location backend
python server.py
```

The API listens on `http://localhost:8000`. Interactive API documentation is available at `http://localhost:8000/docs`.

### 3. Install and start the frontend

In a second terminal, from the `zarahsense` project directory:

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal (typically `http://localhost:5173`).

The frontend defaults to the API at `http://localhost:8000`. To use another backend URL, set `VITE_BACKEND_URL` in the frontend's Vite environment, for example in `frontend/.env`:

```dotenv
VITE_BACKEND_URL=http://localhost:8000
```

Restart the Vite server after changing environment variables.

## API overview

All endpoints are prefixed with `/api`:

| Endpoint | Description |
| --- | --- |
| `GET /stations` | Station locations and live-data status |
| `GET /current/{station_id}` | Latest available reading and PM2.5 NowCast |
| `GET /forecast/{station_id}` | Forecast up to 24 hours ahead |
| `POST /whatif/{station_id}` | Forecast with optional sensor-value overrides |
| `GET /accuracy/{station_id}?horizon=1` | Accuracy metrics for a forecast horizon |
| `GET /correlation` | Correlation data for measured inputs |
| `POST /chat` | Ask a project-scoped question using the Gemini free tier |
| `GET /model` | Model and input-feature information |
| `GET /files` | Available downloadable data and reports |

Supported station IDs include `setia-eco`, `ttdi`, `sejati`, `klcc`, and `enviro-exceltech`.
The `enviro-exceltech` station uses the `ENVIRO_EXCELTECH_SDN_BHD` dataset and model records.

## Retraining the model

The checked-in model artifacts are used by default. To retrain the model and regenerate the accuracy report, run from the project directory with the backend dependencies installed:

```powershell
python backend\scripts\train.py
```

This updates files under `backend/data/`, including `rf_model.joblib` and `accuracy.json`.
To regenerate the accuracy report using the saved model without retraining or changing model artifacts, run:

```powershell
python backend\scripts\train.py --evaluate-only
```
