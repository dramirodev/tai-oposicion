"""Prepare Agentic Test Explorer auth.json using only TAI's local emulators."""
import asyncio
import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv(Path.cwd() / ".env", override=False)

APP_URL = os.getenv("APP_URL", "http://127.0.0.1:4187")
EMAIL = os.getenv("TAI_EXPLORER_EMAIL", "tai-supertest@example.test")
STATE_PATH = os.getenv("TAI_EXPLORER_AUTH_STATE", "auth.json")


async def guard_request(route):
    request = route.request
    url = urlparse(request.url)
    local = url.hostname in {"127.0.0.1", "localhost", "::1"} and url.port in {4187, 9099, 8080}
    google_asset = (
        url.hostname == "apis.google.com"
        and request.method == "GET"
        and (url.path == "/js/api.js" or url.path.startswith("/_/scs/"))
    )
    if local or google_asset:
        await route.continue_()
    else:
        print(f"BLOCKED external request: {url.scheme}://{url.hostname}{url.path}")
        await route.abort("blockedbyclient")


async def main():
    if APP_URL != "http://127.0.0.1:4187" or os.getenv("GCLOUD_PROJECT") != "demo-tai-auth" or os.getenv("FIREBASE_AUTH_EMULATOR_HOST") != "127.0.0.1:9099" or os.getenv("FIRESTORE_EMULATOR_HOST") != "127.0.0.1:8080":
        raise SystemExit("Only demo-tai-auth on fixed loopback emulators is permitted")
    if not EMAIL.endswith("@example.test"):
        raise SystemExit("TAI_EXPLORER_EMAIL must use the reserved .test domain")
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=os.getenv("TAI_EXPLORER_HEADED") != "1")
        context = await browser.new_context(service_workers="block")
        await context.route("**/*", guard_request)
        page = await context.new_page()
        await page.goto(APP_URL + "/#/settings")
        await page.get_by_role("button", name="Entrar con Google").wait_for()
        popup_task = asyncio.create_task(page.wait_for_event("popup"))
        await page.get_by_role("button", name="Entrar con Google").click()
        popup = await popup_task
        await popup.wait_for_load_state()
        await popup.get_by_role("button", name="Add new account").click()
        await popup.get_by_label("Email").fill(EMAIL)
        close_task = asyncio.create_task(popup.wait_for_event("close"))
        await popup.get_by_role("button", name="Sign in with Google.com").click()
        await close_task
        await page.goto(APP_URL + "/#/settings")
        await page.get_by_role("button", name="Cerrar sesión").wait_for(timeout=15000)
        if EMAIL == "tai-supertest@example.test":
            await page.goto(APP_URL + "/#/acceso")
            await page.get_by_role("heading", name="Accesos", exact=True).wait_for(timeout=15000)
        await context.storage_state(path=STATE_PATH, indexed_db=True)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
