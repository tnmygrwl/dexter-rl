async def improvement_reward(completion, answer, state, **kwargs) -> float:
    scores = state.get("scores", [0])
    current = scores[-1]
    prev = scores[-2] if len(scores) > 1 else 0
    return (current - prev) / 10.0


async def absolute_score(completion, answer, state, **kwargs) -> float:
    scores = state.get("scores", [0])
    return scores[-1] / 10.0
