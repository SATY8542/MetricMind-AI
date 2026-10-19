"""
Automated Business Reports engine for MetricMind AI.
Generates weekly, monthly, and quarterly executive summaries,
and exports high-fidelity PDF and Excel reports with generation timestamps.
"""

import io
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from analytics import get_kpi_overview, get_breakdowns, get_trends

def generate_report_summary(
    org_id: Optional[str] = None,
    dataset_id: Optional[str] = None,
    period_type: str = "monthly",
    year: Optional[int] = None,
    quarter: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate structured executive report data for display or export scoped to active dataset."""
    kpis = get_kpi_overview(org_id=org_id, dataset_id=dataset_id, year=year, quarter=quarter)
    breakdowns = get_breakdowns(org_id=org_id, dataset_id=dataset_id, year=year, quarter=quarter)
    trends = get_trends(org_id=org_id, dataset_id=dataset_id, year=year)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
    period_title = f"{period_type.capitalize()} Business Performance Report"
    if quarter:
        period_title += f" - {quarter} {year or ''}"
    elif year:
        period_title += f" - FY {year}"

    top_product = breakdowns["top_products"][0]["product"] if breakdowns["top_products"] else "N/A"
    top_region = breakdowns["regional_performance"][0]["region"] if breakdowns["regional_performance"] else "N/A"

    findings = [
        f"Generated total revenue of ${kpis['total_revenue']:,.2f} with a net profit margin of {kpis['profit_margin_percent']:.1f}%.",
        f"Top performing product line was '{top_product}' accounting for significant volume.",
        f"'{top_region}' led regional performance with consistent operational profitability.",
        f"Average Order Value (AOV) settled at ${kpis['average_order_value']:,.2f} across {kpis['total_orders']:,} verified transactions."
    ]

    return {
        "title": period_title,
        "generated_at": timestamp,
        "period_type": period_type,
        "kpis": kpis,
        "top_products": breakdowns["top_products"],
        "regional_performance": breakdowns["regional_performance"],
        "sales_by_channel": breakdowns["sales_by_channel"],
        "monthly_trend": trends["monthly_trend"][-6:],
        "findings": findings,
    }

def export_excel_report(report_data: Dict[str, Any]) -> io.BytesIO:
    """Generate professional styled Excel report workbook."""
    wb = openpyxl.Workbook()

    # 1. Executive Summary Sheet
    ws_summary = wb.active
    ws_summary.title = "Executive Summary"

    # Styling Palette
    navy_dark = "192A56"
    gold_accent = "F7D794"
    header_fill = PatternFill(start_color=navy_dark, end_color=navy_dark, fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=16, bold=True, color=navy_dark)
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="666666")
    bold_font = Font(name="Calibri", size=11, bold=True)
    currency_format = "$#,##0.00"
    percent_format = "0.0%"

    # Header block
    ws_summary["A1"] = "MetricMind AI - Business Intelligence Report"
    ws_summary["A1"].font = title_font
    ws_summary["A2"] = f"Report Title: {report_data['title']} | Generated: {report_data['generated_at']}"
    ws_summary["A2"].font = subtitle_font

    # KPI Summary Cards Table
    ws_summary["A4"] = "Key Performance Indicator (KPI)"
    ws_summary["B4"] = "Current Value"
    ws_summary["C4"] = "Benchmark / Growth"
    for col in ["A4", "B4", "C4"]:
        ws_summary[col].fill = header_fill
        ws_summary[col].font = header_font

    kpis = report_data["kpis"]
    kpi_rows = [
        ("Total Revenue", kpis["total_revenue"], f"+{kpis.get('revenue_growth_percent', 0)}% QoQ", currency_format),
        ("Total Net Profit", kpis["total_profit"], f"+{kpis.get('profit_growth_percent', 0)}% QoQ", currency_format),
        ("Total Costs", kpis["total_costs"], "Operational Expenses", currency_format),
        ("Profit Margin", kpis["profit_margin_percent"] / 100.0, "Healthy target > 20%", percent_format),
        ("Total Orders", kpis["total_orders"], f"+{kpis.get('orders_growth_percent', 0)}% Vol", "#,##0"),
        ("Units Sold", kpis["units_sold"], "Volume", "#,##0"),
        ("Average Order Value (AOV)", kpis["average_order_value"], "Per Transaction", currency_format),
    ]

    for idx, (label, val, note, num_fmt) in enumerate(kpi_rows, start=5):
        ws_summary[f"A{idx}"] = label
        c = ws_summary[f"B{idx}"]
        c.value = val
        c.number_format = num_fmt
        c.font = bold_font
        ws_summary[f"C{idx}"] = note

    # Key Findings
    start_findings = len(kpi_rows) + 6
    ws_summary[f"A{start_findings}"] = "Executive Key Findings"
    ws_summary[f"A{start_findings}"].font = Font(size=12, bold=True, color=navy_dark)

    for f_idx, finding in enumerate(report_data.get("findings", []), start=start_findings + 1):
        ws_summary[f"A{f_idx}"] = f"• {finding}"

    # 2. Product Performance Sheet
    ws_products = wb.create_sheet(title="Products")
    ws_products["A1"] = "Product"
    ws_products["B1"] = "Revenue"
    ws_products["C1"] = "Profit"
    ws_products["D1"] = "Units Sold"
    ws_products["E1"] = "Margin %"
    for col in ["A1", "B1", "C1", "D1", "E1"]:
        ws_products[col].fill = header_fill
        ws_products[col].font = header_font

    for idx, p in enumerate(report_data.get("top_products", []), start=2):
        ws_products[f"A{idx}"] = p["product"]
        ws_products[f"B{idx}"] = p["revenue"]
        ws_products[f"B{idx}"].number_format = currency_format
        ws_products[f"C{idx}"] = p["profit"]
        ws_products[f"C{idx}"].number_format = currency_format
        ws_products[f"D{idx}"] = p["units_sold"]
        ws_products[f"D{idx}"].number_format = "#,##0"
        ws_products[f"E{idx}"] = p["margin_percent"] / 100.0
        ws_products[f"E{idx}"].number_format = percent_format

    # Auto-adjust column widths
    for sheet in wb.worksheets:
        for col in sheet.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            sheet.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf

def export_pdf_report(report_data: Dict[str, Any]) -> io.BytesIO:
    """Generate high-quality printable PDF executive report."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )
    styles = getSampleStyleSheet()

    navy_hex = colors.HexColor("#192A56")
    gold_hex = colors.HexColor("#F7D794")

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=20,
        textColor=navy_hex,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.gray,
        spaceAfter=15,
    )
    section_style = ParagraphStyle(
        "ReportSection",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=navy_hex,
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.black,
        leading=14,
    )

    story = []

    # Header
    story.append(Paragraph("MetricMind AI — Business Intelligence Report", title_style))
    story.append(Paragraph(f"{report_data['title']} &nbsp;|&nbsp; Generated on: {report_data['generated_at']}", subtitle_style))
    story.append(Spacer(1, 10))

    # Executive Findings
    story.append(Paragraph("Executive Summary & Strategic Findings", section_style))
    for f in report_data.get("findings", []):
        story.append(Paragraph(f"• {f}", body_style))
    story.append(Spacer(1, 15))

    # KPI Table
    story.append(Paragraph("Key Performance Indicators", section_style))
    kpis = report_data["kpis"]
    kpi_data = [
        ["Metric", "Value", "Benchmark / Context"],
        ["Total Revenue", f"${kpis['total_revenue']:,.2f}", f"+{kpis.get('revenue_growth_percent', 0)}% Growth"],
        ["Total Profit", f"${kpis['total_profit']:,.2f}", f"+{kpis.get('profit_growth_percent', 0)}% Growth"],
        ["Total Costs", f"${kpis['total_costs']:,.2f}", "Material, Shipping & Labor"],
        ["Profit Margin", f"{kpis['profit_margin_percent']:.1f}%", "Healthy margin standard"],
        ["Total Orders", f"{kpis['total_orders']:,}", "Verified transactions"],
        ["Units Sold", f"{kpis['units_sold']:,}", "Volume"],
        ["Average Order Value (AOV)", f"${kpis['average_order_value']:,.2f}", "Average per customer order"],
    ]

    t_kpi = Table(kpi_data, colWidths=[180, 140, 180])
    t_kpi.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), navy_hex),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F8F9FA"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("ALIGN", (1, 1), (1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 15))

    # Top Products Table
    story.append(Paragraph("Top-Performing Products Breakdown", section_style))
    prod_data = [["Product", "Revenue", "Profit", "Units Sold", "Margin %"]]
    for p in report_data.get("top_products", [])[:5]:
        prod_data.append([
            p["product"],
            f"${p['revenue']:,.2f}",
            f"${p['profit']:,.2f}",
            f"{p['units_sold']:,}",
            f"{p['margin_percent']:.1f}%",
        ])

    t_prod = Table(prod_data, colWidths=[150, 100, 100, 80, 70])
    t_prod.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), navy_hex),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F8F9FA"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t_prod)

    doc.build(story)
    buf.seek(0)
    return buf
