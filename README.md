# Smart Kitchen — Hackathon MVP

A React + Vite frontend and FastAPI backend for managing Ammi's groceries, kitchen inventory, expiry dates, and AI recipes. Recipe generation calls the real Gemini API; it does not fabricate fallback recipes.

## First: requirements
- Windows 10/11
- Node.js LTS (includes npm): https://nodejs.org/
- Python 3.12, 3.13, or 3.14: https://www.python.org/downloads/windows/

## Start the backend (Terminal 1)
1. Open this project folder in VS Code.
2. Open Terminal → New Terminal.
3. Run:

```bat
cd backend
setup_windows.bat
```

The script creates `backend\.venv`, installs compatible packages without asking pip to compile `pydantic-core` from source, and starts the API. Keep this terminal open.

Check the API at http://127.0.0.1:8000/docs or http://127.0.0.1:8000/health.

### Gemini API key (for real AI recipes)
The setup creates `backend/.env` from `.env.example` if it doesn't exist. Open `backend/.env` and set:

```env
GEMINI_API_KEY=put_your_real_key_here
GEMINI_MODEL=gemini-2.0-flash
FRONTEND_ORIGIN=http://localhost:5173
```

Get a key from Google AI Studio and confirm the selected model is available to your account. Never put this key in frontend files or share it publicly. Restart the backend after changing `.env`.

## Start the frontend (Terminal 2)
Open a **second** terminal at the project root (the folder containing `package.json`) and run:

```bat
npm install
npm run dev
```

Or double-click `start_frontend_windows.bat`. Open the localhost URL Vite prints, usually http://localhost:5173. Do not open `index.html` by double-clicking it; React needs Vite.

## Demo flow
1. Open Grocery List and add a grocery.
2. Tick its checkbox, enter an expiry date, and confirm.
3. Verify it appears in My Kitchen.
4. Open AI Recipes and generate recipes from the available inventory.

## Features
- Dashboard with inventory and grocery counts
- Add, check, and delete grocery items
- Transfer purchased groceries into kitchen inventory and set expiry dates
- Inventory search/filter and expiry status
- Gemini-powered recipe generation through FastAPI
- Backend validation to reject recipes containing ingredient names not in inventory
- Responsive forest-green / sage interface
- Browser-local persistence via `localStorage`

## Troubleshooting
- **`py` not recognized:** install Python from the official link above, enable the PATH option, then reopen VS Code.
- **`npm` not recognized:** install Node.js LTS, then close and reopen VS Code.
- **`link.exe` or Rust build error:** make sure `backend\requirements.txt` is the updated file from this ZIP and run `setup_windows.bat`; it uses recent dependency versions and prevents a source build of `pydantic-core`. If a stale environment remains, close the backend terminal, delete `backend\.venv`, and rerun the script.
- **Port 8000 already in use:** close the other server terminal before restarting.
- **Recipe generation says API key missing:** add your key to `backend/.env` and restart the backend.

## MVP limitations
- Grocery and inventory data are stored in the browser, not a shared database.
- Login/authentication is not included.
- AI validates ingredient names, but recipe quantities and food-safety advice still need human judgement.
- Initial demo data in the UI is illustrative.
