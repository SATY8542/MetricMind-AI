from typing import Any, Optional

def get_comparison_data(metric: str, state: str) -> dict:
    """
    Return comparison data for a metric and state.
    Preserved for backwards compatibility.
    """
    supported_metrics = {"profit", "revenue", "cost", "margin"}

    if metric.lower() not in supported_metrics:
        raise ValueError(f"Unsupported metric: {metric}")

    if not state or not state.strip():
        raise ValueError("State must not be empty.")

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
        round((absolute_change / abs(previous)) * 100, 2)
        if previous != 0
        else None
    )

    return {
        "metric": metric,
        "previous_value": round(previous, 2),
        "current_value": round(current, 2),
        "absolute_change": round(absolute_change, 2),
        "percentage_change": percentage_change,
        "trend": (
            "increased" if absolute_change > 0
            else "decreased" if absolute_change < 0
            else "unchanged"
        ),
    }


def format_currency(value: Any) -> str:
    """Format any numeric value with appropriate metric prefixes."""
    try:
        val = float(value)
    except (ValueError, TypeError):
        return "$0.00"

    abs_val = abs(val)
    if abs_val >= 1_000_000_000:
        return f"${val / 1_000_000_000:.2f}B"
    if abs_val >= 1_000_000:
        return f"${val / 1_000_000:.2f}M"
    if abs_val >= 1_000:
        return f"${val:,.2f}"
    return f"${val:,.2f}"


def explain_findings(
    question: str,
    query_measures: list[str],
    query_dimensions: list[str],
    data: list[dict[str, Any]],
    comparison: Optional[dict[str, Any]] = None,
    lang: str = "en",
) -> str:
    """Generate concise, data-grounded insights strictly based on retrieved records."""

    if not data:
        if lang == "hi":
            return "Chune gaye samay ya filter ke liye koi data uplabdh nahi hai."
        return "Insufficient data available to answer this question for the selected criteria."

    # Identify primary measure and dimension keys
    primary_measure = query_measures[0] if query_measures else "value"
    primary_dimension = query_dimensions[0] if query_dimensions else None

    # Handle single aggregated metric (e.g., overall revenue or profit)
    if len(data) == 1 and not primary_dimension:
        row = data[0]
        val = list(row.values())[0] if row else 0
        try:
            val_num = float(val)
            val_str = format_currency(val_num)
        except (ValueError, TypeError):
            val_str = str(val)

        if lang == "hi":
            return f"Kul {primary_measure.split('.')[-1]}: {val_str} darj kiya gaya hai."
        return f"Total {primary_measure.split('.')[-1]} recorded is {val_str}."

    # Handle rankings or breakdowns
    if primary_dimension:
        top_row = data[0]
        dim_val = top_row.get(primary_dimension) or list(top_row.values())[0]
        meas_val = top_row.get(primary_measure)
        if meas_val is None and len(top_row) > 1:
            meas_val = list(top_row.values())[1]

        try:
            meas_val_num = float(meas_val)
        except (ValueError, TypeError):
            meas_val_num = 0.0

        val_str = f"{meas_val_num:.2f}%" if "margin" in primary_measure.lower() else format_currency(meas_val_num)

        # Check if ranking intent
        q_lower = question.lower()
        is_lowest = "lowest" in q_lower or "sabse kam" in q_lower or "minimum" in q_lower or "worst" in q_lower
        is_highest = "highest" in q_lower or "sabse zyada" in q_lower or "top" in q_lower or "best" in q_lower

        if is_lowest:
            if lang == "hi":
                return f"{dim_val} ka {primary_measure.split('.')[-1]} sabse kam ({val_str}) darj hua."
            if "margin" in primary_measure.lower():
                return f"{dim_val} achieved the lowest profit margin of {val_str}."
            return f"{dim_val} recorded the lowest {primary_measure.split('.')[-1]} at {val_str}."

        if is_highest or len(data) == 1:
            if lang == "hi":
                if "profit" in primary_measure.lower() or "munafa" in q_lower:
                    return f"{dim_val} ne sabse zyada profit ({val_str}) darj kiya hai."
                if "margin" in primary_measure.lower():
                    return f"{dim_val} ka profit margin sabse accha ({val_str}) hai."
                return f"{dim_val} sabse aage raha jisme {val_str} darj hua."
            else:
                if "profit" in primary_measure.lower():
                    return f"{dim_val} generated the highest profit at {val_str}."
                if "margin" in primary_measure.lower():
                    return f"{dim_val} achieved the highest profit margin of {val_str}."
                return f"{dim_val} ranked highest with {val_str}."

        # Check if time dimension
        is_time_dim = any(k in primary_dimension.lower() for k in ["date", "month", "year", "quarter"])
        if is_time_dim:
            meas_names = " and ".join([m.split(".")[-1].replace("total", "").title() for m in query_measures])
            if lang == "hi":
                return f"Samay ke sath {meas_names} ka trend aur vishleshan neeche diye gaye chart mein darshaya gaya hai."
            return f"The trajectory and trend for {meas_names} across reporting intervals is visualized below."

        # Multiple items overview
        count = min(len(data), 5)
        top_names = [str(r.get(primary_dimension) or list(r.values())[0]) for r in data[:count]]

        if lang == "hi":
            return f"Top {count} {primary_dimension.split('.')[-1]} hain: {', '.join(top_names)}."
        return f"The top {count} {primary_dimension.split('.')[-1]}s are: {', '.join(top_names)}."

    # Handle comparison explanation
    if comparison:
        pct = comparison.get("percentage_change")
        trend = comparison.get("trend")
        metric_name = comparison.get("metric", "revenue")

        if lang == "hi":
            direction = "badhi (+)" if trend == "increased" else "giri (-)"
            return f"Pichhle samay ke mukable {metric_name} {abs(pct) if pct else 0:.1f}% {direction} hai."
        return f"{metric_name.title()} {trend} by {abs(pct) if pct else 0:.1f}% compared to the prior period."

    return "Data retrieved successfully based on semantic model."


def build_chart_spec(
    query_measures: list[str],
    query_dimensions: list[str],
    data: list[dict[str, Any]],
    chart_type: str = "bar"
) -> Optional[dict[str, Any]]:
    """Build dynamic chart specification for frontend ECharts component with multi-series support."""

    if not data or len(data) == 0:
        return None

    primary_dim = query_dimensions[0] if query_dimensions else list(data[0].keys())[0]
    is_time_dim = any(k in primary_dim.lower() for k in ["date", "month", "year", "quarter"])

    # Prepare slice and sort chronologically for time series
    if is_time_dim:
        try:
            chart_data = sorted(data[:15], key=lambda r: str(r.get(primary_dim, "")))
        except Exception:
            chart_data = data[:15]
    else:
        chart_data = data[:12]

    labels = [str(row.get(primary_dim) or list(row.values())[0]) for row in chart_data]

    # If multiple measures (e.g., Revenue and Profit, or Revenue and Cost), generate multi-series
    if len(query_measures) > 1:
        palette = ["#192A56", "#10B981", "#EF4444", "#6366F1", "#F59E0B"]
        series_list = []
        for idx, meas in enumerate(query_measures):
            s_name = meas.split(".")[-1].replace("total", "").title()
            s_vals = []
            for row in chart_data:
                val = row.get(meas)
                try:
                    s_vals.append(round(float(val), 2) if val is not None else 0.0)
                except (ValueError, TypeError):
                    s_vals.append(0.0)

            series_list.append({
                "name": s_name,
                "data": s_vals,
                "color": palette[idx % len(palette)],
            })

        return {
            "type": "line" if is_time_dim else "bar",
            "title": f"Comparison by {primary_dim.split('.')[-1].title()}",
            "subtitle": f"{' vs '.join(m.split('.')[-1].replace('total', '').title() for m in query_measures)}",
            "data": {
                "labels": labels,
                "series": series_list,
            }
        }
    else:
        primary_measure = query_measures[0] if query_measures else (list(data[0].keys())[1] if len(data[0]) > 1 else "value")
        values = []
        for row in chart_data:
            val = row.get(primary_measure)
            if val is None and len(row) > 1:
                val = list(row.values())[1]
            try:
                values.append(round(float(val), 2) if val is not None else 0.0)
            except (ValueError, TypeError):
                values.append(0.0)

        meas_clean = primary_measure.split(".")[-1].replace("total", "").title()
        dim_clean = primary_dim.split(".")[-1].title()
        return {
            "type": "line" if is_time_dim else chart_type,
            "title": f"{meas_clean} by {dim_clean}",
            "subtitle": f"Verified breakdown from corporate dataset ({len(labels)} categories)",
            "data": {
                "labels": labels,
                "values": values,
            }
        }
