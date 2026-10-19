import re
from schemas import SemanticQuery

INDIAN_STATES = [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar",
    "chhattisgarh", "goa", "gujarat", "haryana", "himachal pradesh",
    "jharkhand", "karnataka", "kerala", "madhya pradesh",
    "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland",
    "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu",
    "telangana", "tripura", "uttar pradesh", "uttarakhand",
    "west bengal",
]

STATE_PATTERN = "|".join(
    re.escape(state) for state in sorted(INDIAN_STATES, key=len, reverse=True)
)

HINDI_INDICATORS = [
    r"\bkis\b", r"\bkaun\b", r"\bsabse\b", r"\bmahine\b", r"\bpichhle\b",
    r"\bis mahine\b", r"\bhua\b", r"\bbadhi\b", r"\bkam\b", r"\bzyada\b",
    r"\bmunafa\b", r"\bbikri\b", r"\bkharche\b", r"\bfayda\b", r"\bmein\b",
    r"\bkitni\b", r"\bse\b", r"\bhai\b"
]

def detect_language(text: str) -> str:
    for pattern in HINDI_INDICATORS:
        if re.search(pattern, text):
            return "hi"
    return "en"

def parse_question(question: str) -> SemanticQuery:
    """Convert supported natural-language questions into SemanticQuery (English & Hindi)."""

    if not isinstance(question, str) or not question.strip():
        raise ValueError("Question must not be empty.")

    text = re.sub(r"\s+", " ", question.strip().lower())
    lang = detect_language(text)

    # State-level filter rejection guardrail
    if re.search(r"\b(?:in|for)\s+(?:" + STATE_PATTERN + r")\b", text):
        raise ValueError("State-level filtering is not supported.")

    measures = []

    # Check for revenue / sales
    has_revenue = bool(
        re.search(r"\b(?:revenue|sales|turnover|bikri|kamai)\b", text)
    )
    # Check for profit / margin
    has_profit = bool(
        re.search(r"\b(?:profit|earnings|net profit|munafa|fayda|bachat)\b", text)
    )
    has_margin = bool(
        re.search(r"\b(?:margin|profit margin|margin percent)\b", text)
    )
    # Check for cost / expenses
    has_cost = bool(
        re.search(r"\b(?:cost|costs|expenses|spending|kharche)\b", text)
    )
    # Check for orders
    has_orders = bool(
        re.search(r"\b(?:orders|total orders)\b", text)
    )
    # Check for units sold
    has_units = bool(
        re.search(r"\b(?:units|units sold|volume|quantity)\b", text)
    )

    if has_margin:
        measures.append("Sales.averageMargin")
    if has_revenue:
        measures.append("Sales.revenue")
    if has_profit and not ("margin" in text):
        measures.append("Sales.totalProfit")
    elif has_profit and "margin" in text and ("profit and margin" in text or "margin and profit" in text):
        measures.append("Sales.totalProfit")
    if has_cost:
        measures.append("Sales.totalCost")
    if has_orders:
        measures.append("Sales.totalOrders")
    if has_units and not has_revenue:
        measures.append("Sales.totalUnitsSold")

    # If no recognized business measure is found, raise error
    if not measures:
        raise ValueError("Missing or unsupported measure. Supported measures: revenue, profit, cost, margin, orders, units.")

    query = SemanticQuery(measures=measures, language=lang)

    # Dimension resolution
    dimensions = []

    # Product dimension
    if re.search(r"\b(?:product|products|item|items|cheez)\b", text) or \
       re.search(r"\b(?:kis product|which product|top products|top five products|declining products)\b", text):
        dimensions.append("Sales.product")

    # Region dimension
    if re.search(r"\b(?:region|regions|geography|territory|kaun se region|which region)\b", text):
        dimensions.append("Sales.region")

    # Channel dimension
    if re.search(r"\b(?:channel|channels|kis channel|which channel)\b", text):
        dimensions.append("Sales.channel")

    # Country dimension
    if re.search(r"\bby country\b", text):
        dimensions.append("Sales.country")

    # Month / Temporal dimension
    if re.search(r"\bby month\b", text):
        dimensions.append("Sales.orderDate")
    elif re.search(r"\bby quarter\b", text) or (re.search(r"\bthis quarter\b", text) and "change" in text):
        dimensions.append("Sales.quarter")
    elif re.search(r"\b(?:trend|trends|over time|trajectory)\b", text):
        dimensions.append("Sales.orderDate")
    elif re.search(r"\b(?:compare|versus|vs)\b", text) and not dimensions:
        dimensions.append("Sales.orderDate")

    query.dimensions = dimensions

    # Country filters
    country_match = re.search(
        r"\b(?:for|in)\s+(india|usa|united states|united kingdom|canada|australia|germany|france|brazil|japan)\b",
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
            "germany": "Germany",
            "france": "France",
            "brazil": "Brazil",
            "japan": "Japan",
        }
        query.filters["Sales.country"] = country_names.get(country, country.title())

    # Region filters
    region_match = re.search(
        r"\b(?:for|in)\s+(north america|europe|asia pacific|latin america|middle east)\b",
        text,
    )
    if region_match:
        query.filters["Sales.region"] = region_match.group(1).title()

    # Time range detection
    if re.search(r"\b(?:last month|pichhle mahine)\b", text):
        query.time_range = "last month"
    elif re.search(r"\b(?:this month|is mahine)\b", text):
        query.time_range = "this month"
    elif re.search(r"\b(?:last quarter|pichhle quarter)\b", text):
        query.time_range = "last quarter"
    elif re.search(r"\b(?:this quarter|is quarter)\b", text):
        query.time_range = "this quarter"
    elif re.search(r"\b(?:last year|pichhle saal)\b", text):
        query.time_range = "last year"
    elif re.search(r"\b(?:this year|is saal)\b", text):
        query.time_range = "this year"

    # Comparison intent
    if re.search(r"\b(?:compared with|compared to|comparison mein|decrease|decrease compared|change this quarter|declining)\b", text):
        query.question_intent = "comparison"
        if re.search(r"\b(?:previous month|pichhle mahine|last month)\b", text):
            query.comparison_period = "previous_month"
        elif re.search(r"\b(?:previous quarter|pichhle quarter|last quarter|this quarter)\b", text):
            query.comparison_period = "previous_quarter"
        elif re.search(r"\b(?:previous year|pichhle saal|last year)\b", text):
            query.comparison_period = "previous_year"

    # Ranking / Top N / Highest / Lowest
    if re.search(r"\b(?:top five|top 5)\b", text):
        query.limit = 5
        query.order_direction = "desc"
        query.question_intent = "ranking"
    elif re.search(r"\b(?:top ten|top 10)\b", text):
        query.limit = 10
        query.order_direction = "desc"
        query.question_intent = "ranking"
    elif re.search(r"\b(?:highest|sabse zyada|maximum|best performing|top)\b", text):
        query.limit = 1
        query.order_direction = "desc"
        query.question_intent = "ranking"
    elif re.search(r"\b(?:lowest|sabse kam|minimum|worst performing|least)\b", text):
        query.limit = 1
        query.order_direction = "asc"
        query.question_intent = "ranking"
    elif re.search(r"\b(?:declining|falling|girti hui)\b", text):
        query.question_intent = "declining"

    # Order by metric
    if "margin" in text and "Sales.averageMargin" in measures:
        query.order_by = "Sales.averageMargin"
    elif measures:
        query.order_by = measures[0]

    return query
