
import re

from schemas import SemanticQuery


def parse_question(question: str) -> SemanticQuery:
    """Convert supported natural-language questions into SemanticQuery."""

    if not isinstance(question, str) or not question.strip():
        raise ValueError("Question must not be empty.")

    text = re.sub(r"\s+", " ", question.strip().lower())

    # Currently supported measure
    if not re.search(r"\brevenue\b", text):
        raise ValueError("Missing or unsupported measure: revenue.")

    query = SemanticQuery(measures=["Sales.revenue"])

    # Reject unsupported Indian state filters
    states = [
        "andhra pradesh", "arunachal pradesh", "assam", "bihar",
        "chhattisgarh", "goa", "gujarat", "haryana", "himachal pradesh",
        "jharkhand", "karnataka", "kerala", "madhya pradesh",
        "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland",
        "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu",
        "telangana", "tripura", "uttar pradesh", "uttarakhand",
        "west bengal",
    ]

    state_pattern = "|".join(
        re.escape(state) for state in sorted(states, key=len, reverse=True)
    )

    if re.search(r"\b(?:in|for)\s+(?:" + state_pattern + r")\b", text):
        raise ValueError("State-level filtering is not supported.")

    # Revenue by country
    if re.search(r"\bby country\b", text):
        query.dimensions = ["Sales.country"]

    # Country filters
    country_match = re.search(
        r"\b(?:for|in)\s+(india|usa|united states|"
        r"united kingdom|canada|australia)\b",
        text,
    )

    if country_match:
        country = country_match.group(1)

        country_names = {
            "india": "India",
            "usa": "United States",
            "united states": "United States",
            "united kingdom": "United Kingdom",
            "canada": "Canada",
            "australia": "Australia",
        }

        query.filters = {
            "Sales.country": country_names[country]
        }

    # Time range
    if re.search(r"\blast month\b", text):
        query.time_range = "last month"

    # Revenue grouped by month
    if re.search(r"\bby month\b", text):
        query.dimensions = ["Sales.orderDate"]

    return query
