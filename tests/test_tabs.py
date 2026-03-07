import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_scrape_tabs_returns_string():
    """Tab scraper should return a non-empty string of tab content."""
    from dexter_rl.tabs import TabScraper

    mock_first_link = MagicMock()
    mock_first_link.click = AsyncMock()

    mock_tab_el = MagicMock()
    mock_tab_el.inner_text = AsyncMock(
        return_value="Em G D A7sus4\ne|---0---3---2---0---\nB|---0---0---3---3---"
    )

    mock_page = MagicMock()
    mock_page.goto = AsyncMock()
    mock_page.wait_for_selector = AsyncMock()
    mock_page.query_selector = AsyncMock(side_effect=[mock_first_link, mock_tab_el])
    mock_page.close = AsyncMock()

    mock_context = MagicMock()
    mock_context.new_page = AsyncMock(return_value=mock_page)
    mock_context.close = AsyncMock()

    mock_browser = MagicMock()
    mock_browser.close = AsyncMock()

    mock_pw = MagicMock()
    mock_pw.chromium.connect_over_cdp = AsyncMock(return_value=mock_browser)
    mock_browser.contexts = [mock_context]

    with patch("dexter_rl.tabs.Browserbase") as mock_bb_cls, \
         patch("dexter_rl.tabs.async_playwright") as mock_pw_ctx:
        mock_bb = MagicMock()
        mock_bb.sessions.create.return_value = MagicMock(
            id="sess_123",
            connect_url="wss://connect.browserbase.com/sess_123"
        )
        mock_bb_cls.return_value = mock_bb
        mock_pw_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_pw)
        mock_pw_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        scraper = TabScraper()
        tabs = await scraper.scrape("Wonderwall", "guitar")

    assert isinstance(tabs, str)
    assert len(tabs) > 0


def test_cache_returns_same_result():
    """Scraper should cache results for the same song."""
    from dexter_rl.tabs import TabScraper

    scraper = TabScraper()
    scraper._cache[("wonderwall", "guitar")] = "cached tabs"
    import asyncio
    result = asyncio.run(scraper.scrape("Wonderwall", "guitar"))
    assert result == "cached tabs"
