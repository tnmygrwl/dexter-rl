import os
from browserbase import Browserbase
from playwright.async_api import async_playwright

ULTIMATE_GUITAR_SEARCH = "https://www.ultimate-guitar.com/search.php?search_type=title&value={query}"


class TabScraper:
    def __init__(self):
        self._cache: dict[tuple[str, str], str] = {}

    async def scrape(self, song: str, instrument: str) -> str:
        key = (song.lower(), instrument.lower())
        if key in self._cache:
            return self._cache[key]

        tabs = await self._scrape_browserbase(song, instrument)
        self._cache[key] = tabs
        return tabs

    async def _scrape_browserbase(self, song: str, instrument: str) -> str:
        bb = Browserbase()
        session = bb.sessions.create(project_id=os.environ.get("BROWSERBASE_PROJECT_ID", ""))

        async with async_playwright() as pw:
            browser = await pw.chromium.connect_over_cdp(session.connect_url)
            context = browser.contexts[0]
            page = await context.new_page()

            query = f"{song} {instrument} tabs"
            await page.goto(ULTIMATE_GUITAR_SEARCH.format(query=query))
            await page.wait_for_selector("article a", timeout=10000)

            first_link = await page.query_selector("article a")
            if first_link:
                await first_link.click()
                await page.wait_for_selector("[class*='Tablature'], pre, .js-tab-content", timeout=10000)

                tab_el = await page.query_selector("[class*='Tablature'], pre, .js-tab-content")
                if tab_el:
                    tabs = await tab_el.inner_text()
                    await page.close()
                    await browser.close()
                    return tabs

            await page.close()
            await browser.close()
            return f"[Tabs not found for {song}. Use standard {instrument} chords.]"
