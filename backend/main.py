import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
import pandas as pd

app = FastAPI(title="MetricMind Backend API", version="1.0.0")

REQUIRED_COLUMNS = [
    "Order_ID", "Order_Date", "Year", "Quarter", "Month", "Region",
    "Country", "Product", "Channel", "Units_Sold", "Unit_Price",
    "Revenue", "Material_Cost", "Shipping_Cost", "Labor_Cost",
    "Marketing_Cost", "Total_Cost", "Profit", "Margin_Percent"
]

def load_dataset() -> pd.DataFrame:
    base_dir = Path(__file__).resolve().parent
    candidates = [
        base_dir / "data" / "MetricMind_Corporate_Sales_Dataset.csv",
        Path.cwd() / "backend" / "data" / "MetricMind_Corporate_Sales_Dataset.csv",
        Path.cwd() / "data" / "MetricMind_Corporate_Sales_Dataset.csv",
    ]

    found_path = None
    for path in candidates:
        if path.is_file():
            found_path = path
            break

    if not found_path:
        searched = [str(p) for p in candidates]
        raise FileNotFoundError(
            f"MetricMind sales dataset file not found. Searched locations: {searched}"
        )

    df = pd.read_csv(found_path)
    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(
            f"Dataset at '{found_path}' is missing required columns: {missing}"
        )

    return df

data = load_dataset()

@app.get("/")
def home():
    return {"message": "MetricMind API is running"}

@app.get("/sales")
def get_sales():
    return data.to_dict(orient="records")

@app.get("/summary")
def get_summary():
    return {
        "total_orders": len(data),
        "total_revenue": round(float(data["Revenue"].sum()), 2),
        "total_profit": round(float(data["Profit"].sum()), 2),
        "total_units_sold": int(data["Units_Sold"].sum())
    }

@app.get("/sales/region/{region}")
def get_sales_by_region(region: str):
    filtered_data = data[data["Region"].str.lower() == region.lower()]
    return filtered_data.to_dict(orient="records")

@app.get("/summary/region/{region}")
def get_region_summary(region: str):
    filtered_data = data[data["Region"].str.lower() == region.lower()]

    if filtered_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Region '{region}' not found"
        )

    return {
        "region": region,
        "total_orders": len(filtered_data),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2)
    }

@app.get("/summary/product/{product}")
def get_product_summary(product: str):
    filtered_data = data[data["Product"].str.lower() == product.lower()]

    if filtered_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Product '{product}' not found"
        )

    return {
        "product": product,
        "total_orders": len(filtered_data),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2)
    }

@app.get("/summary/channel/{channel}")
def get_channel_summary(channel: str):
    filtered_data = data[data["Channel"].str.lower() == channel.lower()]

    if filtered_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Channel '{channel}' not found"
        )

    return {
        "channel": channel,
        "total_orders": len(filtered_data),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2)
    }

@app.get("/summary/year/{year}")
def get_year_summary(year: int):
    filtered_data = data[data["Year"] == year]

    if filtered_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Year '{year}' not found"
        )

    return {
        "year": year,
        "total_orders": len(filtered_data),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2)
    }

@app.get("/summary/month/{month}")
def get_month_summary(month: int):
    filtered_data = data[data["Month"] == month]

    if filtered_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Month '{month}' not found"
        )

    return {
        "month": month,
        "total_orders": len(filtered_data),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2)
    }

@app.get("/summary/cost-profit")
def get_cost_profit_summary():
    return {
        "total_material_cost": round(float(data["Material_Cost"].sum()), 2),
        "total_shipping_cost": round(float(data["Shipping_Cost"].sum()), 2),
        "total_labor_cost": round(float(data["Labor_Cost"].sum()), 2),
        "total_marketing_cost": round(float(data["Marketing_Cost"].sum()), 2),
        "total_cost": round(float(data["Total_Cost"].sum()), 2),
        "total_profit": round(float(data["Profit"].sum()), 2),
        "average_margin_percent": round(float(data["Margin_Percent"].mean()), 2)
    }

@app.get("/summary/quarter/{quarter}")
def get_quarter_summary(quarter: str):
    filtered_data = data[
        data["Quarter"].str.upper() == quarter.upper()
    ]

    if filtered_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Quarter '{quarter}' not found"
        )

    return {
        "quarter": quarter.upper(),
        "total_orders": len(filtered_data),
        "total_units_sold": int(filtered_data["Units_Sold"].sum()),
        "total_revenue": round(float(filtered_data["Revenue"].sum()), 2),
        "total_profit": round(float(filtered_data["Profit"].sum()), 2)
    }