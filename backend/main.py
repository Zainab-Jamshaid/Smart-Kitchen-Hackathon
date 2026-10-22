import json
import os
from datetime import date
from pathlib import Path
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="Smart Kitchen API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:4173", "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b"


class InventoryItem(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    quantity: Optional[str] = None
    unit: Optional[str] = None
    expiry_date: Optional[str] = None
    expiry_status: Optional[str] = None


class RecipeRequest(BaseModel):
    # Matches the React frontend request.
    ingredients: list[InventoryItem] = Field(default_factory=list)
    meal_type: Optional[str] = "Any meal"
    max_time: Optional[str] = "30 minutes or less"
    servings: Optional[int] = 3


def is_expired(expiry_date: Optional[str]) -> bool:
    if not expiry_date:
        return False
    try:
        return date.fromisoformat(expiry_date) < date.today()
    except ValueError:
        return False


def expires_soon(expiry_date: Optional[str]) -> bool:
    if not expiry_date:
        return False
    try:
        days_left = (date.fromisoformat(expiry_date) - date.today()).days
        return 0 <= days_left <= 3
    except ValueError:
        return False


def expiry_priority(item: InventoryItem) -> int:
    if not item.expiry_date:
        return 2
    try:
        days_left = (date.fromisoformat(item.expiry_date) - date.today()).days
    except ValueError:
        return 2
    if days_left < 0:
        return 3
    if days_left <= 3:
        return 0
    return 1


def parse_json_object(content: str) -> dict[str, Any]:
    content = content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        content = "\\n".join(lines).strip()
        if content.lower().startswith("json"):
            content = content[4:].lstrip()

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        # Tolerate a short preamble or trailing text around the JSON object.
        start_index = content.find("{")
        end_index = content.rfind("}")
        if start_index < 0 or end_index <= start_index:
            raise
        parsed = json.loads(content[start_index:end_index + 1])

    if not isinstance(parsed, dict):
        raise ValueError("Expected a JSON object.")
    return parsed


@app.get("/")
def root():
    return {"message": "Smart Kitchen API is running", "docs": "/docs"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider": "Groq",
        "ai_configured": bool(os.getenv("GROQ_API_KEY")),
        "model": os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL),
    }


@app.post("/api/recipes/generate")
async def generate_recipes(request: RecipeRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is missing. Add it to backend/.env and restart the backend.",
        )
    if not request.ingredients:
        raise HTTPException(
            status_code=400,
            detail="Add at least one ingredient to your kitchen inventory first.",
        )

    inventory = sorted(request.ingredients, key=expiry_priority)
    inventory_data = [
        {
            "name": item.name.strip(),
            "quantity": item.quantity or "",
            "unit": item.unit or "",
            "expiry_date": item.expiry_date or "",
            "expiry_priority": (
                "expired - do not use" if is_expired(item.expiry_date)
                else "expires soon" if expires_soon(item.expiry_date)
                else "normal"
            ),
        }
        for item in inventory
    ]

    preferences = (
        f"Meal type: {request.meal_type or 'Any meal'}; "
        f"Maximum cooking time: {request.max_time or '30 minutes or less'}; "
        f"Servings: {request.servings or 3}"
    )
    prompt = f"""
You are Smart Kitchen, a practical home-cooking assistant.
Today's date is {date.today().isoformat()}.

Create 1 to 3 realistic recipes using ONLY non-expired ingredients in the inventory.
Food safety rules:
- Never use any ingredient marked "expired - do not use".
- Prioritize non-expired ingredients marked "expires soon" to reduce food waste.
- Do not invent ingredients that are not in the inventory, except salt, water, and cooking oil.
- Respect the requested maximum cooking time where possible.
- If there are not enough safe ingredients, return fewer recipes or an empty list.
- Do not claim food is safe based only on its expiry date.
- Follow the user's preferences if provided.

User preferences: {preferences}
Inventory JSON:
{json.dumps(inventory_data, ensure_ascii=False)}

Return ONLY one valid JSON object, with no markdown fences or extra text. The first character must be an opening brace and the last character must be a closing brace. If no suitable safe recipe can be made, return an object with a recipes array containing no items. Use this structure:
{{
  "recipes": [
    {{
      "title": "Recipe name",
      "description": "Short description",
      "prep_minutes": 10,
      "cook_minutes": 20,
      "total_minutes": 30,
      "servings": 3,
      "ingredients": [
        {{"name": "ingredient name", "quantity": "quantity", "unit": "unit"}}
      ],
      "instructions": ["Step 1", "Step 2"],
      "uses_expiring": true
    }}
  ]
}}
"""
    model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL)
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Generate practical, safe recipes in the requested JSON structure. Never use expired ingredients. Return valid JSON only.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if response.status_code in (401, 403):
            raise HTTPException(
                status_code=502,
                detail="Groq rejected the API key or model access. Check GROQ_API_KEY and GROQ_MODEL in backend/.env.",
            )
        if response.status_code == 429:
            raise HTTPException(
                status_code=503,
                detail="Groq rate limit or quota reached. Wait a little, then try again.",
            )
        if response.is_error:
            try:
                provider_error = response.json().get("error", {}).get("message", "")
            except (ValueError, AttributeError):
                provider_error = ""
            detail = f"Groq API error ({response.status_code})."
            if provider_error:
                detail += f" {provider_error[:250]}"
            raise HTTPException(status_code=502, detail=detail)

        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            if not isinstance(content, str):
                raise ValueError("Response content was not text.")
            result = parse_json_object(content)
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise HTTPException(
                status_code=502,
                detail="Groq returned an unreadable recipe response. Please try again.",
            ) from exc

        recipes = result.get("recipes", [])
        if not isinstance(recipes, list):
            raise HTTPException(status_code=502, detail="Groq returned an unexpected recipe format.")

        allowed_names = {
            item.name.strip().casefold()
            for item in request.ingredients
            if not is_expired(item.expiry_date)
        }
        pantry_staples = {"salt", "water", "cooking oil", "oil"}
        safe_recipes = []

        for recipe in recipes:
            if not isinstance(recipe, dict):
                continue
            raw_ingredients = recipe.get("ingredients", [])
            if not isinstance(raw_ingredients, list):
                continue

            normalized_ingredients = []
            names = []
            for ingredient in raw_ingredients:
                if not isinstance(ingredient, dict):
                    continue
                name = str(ingredient.get("name", "")).strip()
                if not name:
                    continue
                names.append(name.casefold())
                normalized_ingredients.append({
                    "name": name,
                    "quantity": str(ingredient.get("quantity", "")),
                    "unit": str(ingredient.get("unit", "")),
                })

            if any(name not in allowed_names and name not in pantry_staples for name in names):
                continue

            instructions = recipe.get("instructions", recipe.get("steps", []))
            if not isinstance(instructions, list):
                continue

            def to_minutes(value):
                if isinstance(value, (int, float)):
                    return int(value)
                text_value = str(value or "")
                digits = "".join(ch for ch in text_value if ch.isdigit())
                return int(digits) if digits else 0

            prep = to_minutes(recipe.get("prep_minutes", recipe.get("prep_time", 0)))
            cook = to_minutes(recipe.get("cook_minutes", recipe.get("cook_time", 0)))

            safe_recipes.append({
                "title": str(recipe.get("title") or recipe.get("name") or "Home-style recipe"),
                "description": str(recipe.get("description") or "A simple recipe using ingredients from your kitchen."),
                "prep_minutes": prep,
                "cook_minutes": cook,
                "total_minutes": to_minutes(recipe.get("total_minutes", prep + cook)) or prep + cook,
                "servings": recipe.get("servings", request.servings or 3),
                "ingredients": normalized_ingredients,
                "instructions": [str(step) for step in instructions],
                "uses_expiring": bool(recipe.get("uses_expiring", False)),
            })

        return {"recipes": safe_recipes[:3], "provider": "Groq", "model": model}

    except HTTPException:
        raise
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Groq took too long to respond. Please try again.") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Could not connect to Groq. Check your internet connection and retry.") from exc
