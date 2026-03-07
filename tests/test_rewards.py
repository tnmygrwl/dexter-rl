import pytest


@pytest.mark.asyncio
async def test_improvement_reward_positive():
    """Reward should be positive when score improves."""
    from dexter_rl.rewards import improvement_reward

    state = {"scores": [3, 6]}
    result = await improvement_reward(completion=[], answer="", state=state)
    assert result == pytest.approx(0.3)


@pytest.mark.asyncio
async def test_improvement_reward_negative():
    """Reward should be negative when score decreases."""
    from dexter_rl.rewards import improvement_reward

    state = {"scores": [7, 4]}
    result = await improvement_reward(completion=[], answer="", state=state)
    assert result == pytest.approx(-0.3)


@pytest.mark.asyncio
async def test_improvement_reward_first_attempt():
    """First attempt reward is the raw score normalized."""
    from dexter_rl.rewards import improvement_reward

    state = {"scores": [5]}
    result = await improvement_reward(completion=[], answer="", state=state)
    assert result == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_absolute_score_metric():
    """Absolute score metric returns the last score normalized."""
    from dexter_rl.rewards import absolute_score

    state = {"scores": [3, 7]}
    result = await absolute_score(completion=[], answer="", state=state)
    assert result == pytest.approx(0.7)
