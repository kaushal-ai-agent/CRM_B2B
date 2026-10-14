CRM B2B Trader

This project has:

- a Django backend API
- a React + Vite frontend UI

## Prerequisites

- Python 3.10+
- Node.js and npm
- Git
- A terminal (PowerShell on Windows or bash/zsh on Mac/Linux)

---

## 1) Start the Django backend

### Windows PowerShell

```powershell
cd "C:\Users\Admin\OneDrive\Microsoft Teams Chat Files\Desktop\CRM_B2Btrader"

python -m venv .venv
Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt
pip install "django>=5.2.16" "django-cors-headers>=4.9.0" "djangorestframework>=3.17.1" "django-filter>=26.1" "python-dotenv>=1.2.2"

python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### macOS / Linux / Terminal

cd /path/to/CRM_B2Btrader

python3 -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip
pip install -r requirements.txt
pip install "django>=5.2.16" "django-cors-headers>=4.9.0" "djangorestframework>=3.17.1" "django-filter>=26.1" "python-dotenv>=1.2.2"

python manage.py migrate
python manage.py runserver 0.0.0.0:8000

Open the backend at:

* [http://localhost:8000](http://localhost:8000/)

Optional: load sample Excel data:

python manage.py load_excel_data

## 2) Start the React frontend

### Windows PowerShell

cd "C:\Users\Admin\OneDrive\Microsoft Teams Chat Files\Desktop\CRM_B2Btrader\frontend"

npm install
npm run dev



Open the app at:

* [http://localhost:5173](http://localhost:5173/)

---

## 3) Full startup flow

Use 2 terminals:

1. Backend terminal:
2. cd CRM_B2Btrader
   python manage.py runserver 0.0.0.0:8000


2. Frontend terminal:

cd CRM_B2Btrader/frontend
npm run dev


## 4) Notes

* The frontend API base is configured to call:
  * [http://127.0.0.1:8000/api/v1/](http://127.0.0.1:8000/api/v1/)
* If you get a port error, change the port or stop any process already using 8000 or 5173.

---

## 5) Common commands

python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
npm install
npm run dev
npm run build

This project is ready to run in local development mode when both the backend and frontend servers are started.



## Quick summary

- Backend: `python manage.py runserver 0.0.0.0:8000`
- AGENT service: uvicorn agent_service.app:app --port 8100 --reload
- npm run build
- Frontend: `cd frontend` then `npm install` and `npm run dev`
- Open:
  - UI: http://localhost:5173
  - API: http://localhost:8000

If you want, I can also give you a shorter “copy-paste only” version for the README.## Quick summary

- Backend: `python manage.py runserver 0.0.0.0:8000`
- Frontend: `cd frontend` then `npm install` and `npm run dev`
- Open:
  - UI: http://localhost:5173
  - API: http://localhost:8000

If you want, I can also give you a shorter “copy-paste only” version for the README.
