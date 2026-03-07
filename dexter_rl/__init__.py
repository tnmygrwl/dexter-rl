def __getattr__(name):
    if name == "load_environment":
        from dexter_rl.env import load_environment
        return load_environment
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["load_environment"]
