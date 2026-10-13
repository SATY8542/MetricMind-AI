
import requests
from datetime import date, timedelta
from calendar import monthrange

from schemas import SemanticQuery


CUBE_API_URL = "https://regarding-billy-nearest-compile.trycloudflare.com/cubejs-api/v1/load"


def get_date_range(time_range):
    today = date.today()

    if time_range == "last month":
        first_this_month = today.replace(day=1)
        last_day_previous_month = first_this_month - timedelta(days=1)
        first_previous_month = last_day_previous_month.replace(day=1)

        return [
            first_previous_month.isoformat(),
            last_day_previous_month.isoformat(),
        ]

    if time_range == "this month":
        return [
            today.replace(day=1).isoformat(),
            today.isoformat(),
        ]

    if time_range == "last year":
        return [
            date(today.year - 1, 1, 1).isoformat(),
            date(today.year - 1, 12, 31).isoformat(),
        ]

    if time_range == "this year":
        return [
            date(today.year, 1, 1).isoformat(),
            today.isoformat(),
        ]

    return None


def query_semantic_layer(query: SemanticQuery):
    cube_filters = [
        {
            "member": field,
            "operator": "equals",
            "values": [value],
        }
        for field, value in query.filters.items()
    ]

    cube_query = {
        "measures": query.measures,
        "dimensions": query.dimensions,
        "filters": cube_filters,
    }

    date_range = get_date_range(query.time_range)

    if date_range:
        cube_query["timeDimensions"] = [
            {
                "dimension": "Sales.orderDate",
                "dateRange": date_range,
            }
        ]

    payload = {"query": cube_query}

    response = requests.post(
        CUBE_API_URL,
        json=payload,
        timeout=30,
    )

    response.raise_for_status()

    result = response.json()

    return result.get("data", [])
