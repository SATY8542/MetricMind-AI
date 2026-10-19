import unittest
import io
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

class TestMetricMindBackend(unittest.TestCase):

    def test_health_check(self):
        res = client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["platform"], "MetricMind AI")

    def test_legacy_summary_calculations(self):
        res = client.get("/summary")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["total_revenue"], 0)
        self.assertGreater(data["total_profit"], 0)
        self.assertGreater(data["total_orders"], 0)

    def test_dbt_sales_summary_no_crash(self):
        res = client.get("/dbt/sales-summary")
        self.assertEqual(res.status_code, 200)
        rows = res.json()
        self.assertIsInstance(rows, list)
        self.assertGreater(len(rows), 0)
        # Check presence of avg_margin_percent
        self.assertIn("avg_margin_percent", rows[0])
        self.assertIn("total_revenue", rows[0])
        self.assertIn("total_profit", rows[0])

    def test_analytics_overview_kpis(self):
        res = client.get("/api/analytics/overview")
        self.assertEqual(res.status_code, 200)
        kpi = res.json()
        # Verify all 7 KPI cards
        self.assertIn("total_revenue", kpi)
        self.assertIn("total_profit", kpi)
        self.assertIn("total_costs", kpi)
        self.assertIn("profit_margin_percent", kpi)
        self.assertIn("total_orders", kpi)
        self.assertIn("units_sold", kpi)
        self.assertIn("average_order_value", kpi)

        # Verify math relationships
        self.assertAlmostEqual(kpi["total_revenue"] - kpi["total_costs"], kpi["total_profit"], delta=1.0)
        expected_margin = round(100.0 * kpi["total_profit"] / kpi["total_revenue"], 2)
        self.assertAlmostEqual(kpi["profit_margin_percent"], expected_margin, delta=0.5)

    def test_analytics_trends_and_breakdowns(self):
        res_trends = client.get("/api/analytics/trends")
        self.assertEqual(res_trends.status_code, 200)
        self.assertIn("monthly_trend", res_trends.json())

        res_bd = client.get("/api/analytics/breakdown")
        self.assertEqual(res_bd.status_code, 200)
        bd = res_bd.json()
        self.assertIn("top_products", bd)
        self.assertIn("regional_performance", bd)
        self.assertIn("sales_by_channel", bd)

    def test_auth_login_success_and_failure(self):
        # Demo login
        res_ok = client.post("/api/auth/login", json={"email": "demo@metricmind.ai", "password": "DemoUser123!"})
        self.assertEqual(res_ok.status_code, 200)
        self.assertIn("access_token", res_ok.json())
        token = res_ok.json()["access_token"]

        # Bad password
        res_bad = client.post("/api/auth/login", json={"email": "demo@metricmind.ai", "password": "WrongPassword"})
        self.assertEqual(res_bad.status_code, 401)

        # Authenticated profile
        res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.json()["email"], "demo@metricmind.ai")

    def test_ai_query_english(self):
        res = client.post("/api/ai/query", json={"question": "Which product generated the highest profit this month?"})
        self.assertEqual(res.status_code, 200)
        ans = res.json()
        self.assertIn("summary_text", ans)
        self.assertEqual(ans["language"], "en")
        self.assertTrue(ans["is_data_sufficient"])

    def test_ai_query_hindi(self):
        res = client.post("/api/ai/query", json={"question": "Kaun se region mein profit margin sabse kam hai?"})
        self.assertEqual(res.status_code, 200)
        ans = res.json()
        self.assertIn("summary_text", ans)
        self.assertEqual(ans["language"], "hi")

    def test_forecasting_endpoint(self):
        # Multi-month demo dataset produces 6 projected intervals with evaluation metrics
        res = client.get("/api/analytics/forecast?horizon_months=6&dataset_id=ds_demo_corporate")
        self.assertEqual(res.status_code, 200)
        fc = res.json()
        self.assertEqual(len(fc["forecast"]), 6)
        self.assertIn("mae", fc["evaluation"])
        self.assertIn("rmse", fc["evaluation"])
        self.assertIn("confidence_level", fc["evaluation"])
        self.assertIn("disclaimer", fc)
        # Check confidence bounds
        for pt in fc["forecast"]:
            self.assertGreaterEqual(pt["upper_bound"], pt["forecast"])
            self.assertLessEqual(pt["lower_bound"], pt["forecast"])

        # Short dataset (< 4 months) returns 400 with clear status message rather than fabricated data
        res_short = client.get("/api/analytics/forecast?horizon_months=6&dataset_id=ds_b04967f619e0")
        self.assertEqual(res_short.status_code, 400)
        self.assertIn("Insufficient historical data", res_short.json()["detail"])

    def test_report_summary_and_exports(self):
        res_sum = client.get("/api/reports/summary?period_type=monthly")
        self.assertEqual(res_sum.status_code, 200)
        self.assertIn("findings", res_sum.json())

        # Test Excel export
        res_excel = client.get("/api/reports/export/excel?period_type=monthly")
        self.assertEqual(res_excel.status_code, 200)
        self.assertGreater(len(res_excel.content), 1000)

        # Test PDF export
        res_pdf = client.get("/api/reports/export/pdf?period_type=monthly")
        self.assertEqual(res_pdf.status_code, 200)
        self.assertTrue(res_pdf.content.startswith(b"%PDF"))

    def test_alerts_and_anomalies(self):
        res_scan = client.post("/api/alerts/scan")
        self.assertEqual(res_scan.status_code, 200)
        self.assertIn("total_anomalies_detected", res_scan.json())

        res_hist = client.get("/api/alerts/history")
        self.assertEqual(res_hist.status_code, 200)
        self.assertIsInstance(res_hist.json(), list)

    def test_subscriptions_and_usage(self):
        res_plans = client.get("/api/subscription/plans")
        self.assertEqual(res_plans.status_code, 200)
        self.assertIn("starter", res_plans.json())
        self.assertIn("pro", res_plans.json())

        res_usage = client.get("/api/subscription/usage")
        self.assertEqual(res_usage.status_code, 200)
        self.assertIn("usage", res_usage.json())

if __name__ == "__main__":
    unittest.main()
