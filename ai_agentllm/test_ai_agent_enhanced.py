import unittest
from parser import parse_question
from reasoning import explain_findings, build_chart_spec, calculate_change
from tools import execute_governed_query

class TestEnhancedAIAssistant(unittest.TestCase):

    def test_highest_profit_product_english(self):
        q = parse_question("Which product generated the highest profit this month?")
        self.assertIn("Sales.totalProfit", q.measures)
        self.assertIn("Sales.product", q.dimensions)
        self.assertEqual(q.time_range, "this month")
        self.assertEqual(q.limit, 1)
        self.assertEqual(q.order_direction, "desc")

    def test_top_five_products_revenue(self):
        q = parse_question("What were my top five products by revenue?")
        self.assertIn("Sales.revenue", q.measures)
        self.assertIn("Sales.product", q.dimensions)
        self.assertEqual(q.limit, 5)

    def test_region_margin_hindi(self):
        q = parse_question("Kaun se region mein profit margin sabse kam hai?")
        self.assertEqual(q.language, "hi")
        self.assertIn("Sales.averageMargin", q.measures)
        self.assertIn("Sales.region", q.dimensions)
        self.assertEqual(q.limit, 1)
        self.assertEqual(q.order_direction, "asc")

    def test_hindi_sales_comparison(self):
        q = parse_question("Pichhle mahine ke comparison mein sales kitni badhi?")
        self.assertEqual(q.language, "hi")
        self.assertIn("Sales.revenue", q.measures)
        self.assertEqual(q.comparison_period, "previous_month")

    def test_quarter_revenue_profit_change(self):
        q = parse_question("How did revenue and profit change this quarter?")
        self.assertIn("Sales.revenue", q.measures)
        self.assertIn("Sales.totalProfit", q.measures)
        self.assertEqual(q.time_range, "this quarter")

    def test_governed_query_execution(self):
        q = parse_question("What were my top five products by revenue?")
        rows = execute_governed_query(q, org_id="org_metricmind_demo")
        self.assertGreater(len(rows), 0)
        self.assertIn("Sales.product", rows[0])
        self.assertIn("Sales.revenue", rows[0])

    def test_explanation_english_and_hindi(self):
        sample_data = [{"Sales.product": "Server", "Sales.totalProfit": 94500.0}]
        exp_en = explain_findings("Which product had highest profit?", ["Sales.totalProfit"], ["Sales.product"], sample_data, lang="en")
        self.assertIn("Server", exp_en)
        self.assertIn("highest profit", exp_en)

        exp_hi = explain_findings("Sabse zyada profit kisme hua?", ["Sales.totalProfit"], ["Sales.product"], sample_data, lang="hi")
        self.assertIn("Server", exp_hi)
        self.assertIn("profit", exp_hi)

    def test_chart_spec_generation(self):
        data = [
            {"Sales.product": "Server", "Sales.revenue": 500000.0},
            {"Sales.product": "Laptop", "Sales.revenue": 300000.0},
        ]
        spec = build_chart_spec(["Sales.revenue"], ["Sales.product"], data)
        self.assertIsNotNone(spec)
        self.assertEqual(spec["data"]["labels"], ["Server", "Laptop"])
        self.assertEqual(spec["data"]["values"], [500000.0, 300000.0])

if __name__ == "__main__":
    unittest.main()
