
def get_comparison_data(metric: str, state: str) -> dict:
    """
    Return comparison data for a metric and state.

    NOTE: These are mock values for local testing.
    Replace this function with a real Cube Cloud query
    before using it for actual business insights.
    """
    supported_metrics = {"profit", "revenue"}

    if metric.lower() not in supported_metrics:
        raise ValueError(f"Unsupported metric: {metric}")

    if not state or not state.strip():
        raise ValueError("State must not be empty.")

    # Mock data for testing only
    return {
        "july": 100000,
        "august": 125000,
    }


def calculate_change(previous: float, current: float, metric: str) -> dict:
    """Calculate absolute and percentage change between two values."""

    if previous is None or current is None:
        raise ValueError("Both comparison values are required.")

    previous = float(previous)
    current = float(current)

    absolute_change = current - previous

    percentage_change = (
        (absolute_change / abs(previous)) * 100
        if previous != 0
        else None
    )

    return {
        "metric": metric,
        "previous_value": previous,
        "current_value": current,
        "absolute_change": absolute_change,
        "percentage_change": percentage_change,
        "trend": (
            "increased" if absolute_change > 0
            else "decreased" if absolute_change < 0
            else "unchanged"
        ),
    }
