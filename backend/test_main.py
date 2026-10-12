import unittest
from fastapi.testclient import TestClient
from backend.main import app, data

class TestFastAPIBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_home(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "MetricMind API is running"})

    def test_sales(self):
        response = self.client.get("/sales")
        self.assertEqual(response.status_code, 200)
        records = response.json()
        self.assertEqual(len(records), 5000)

    def test_summary(self):
        response = self.client.get("/summary")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_orders"], 5000)
        self.assertIn("total_revenue", data)
        self.assertIn("total_profit", data)
        self.assertIn("total_units_sold", data)

    def test_cost_profit(self):
        response = self.client.get("/summary/cost-profit")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total_cost", data)
        self.assertIn("total_profit", data)
        self.assertIn("average_margin_percent", data)

    def test_quarter_summary(self):
        response = self.client.get("/summary/quarter/Q1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["quarter"], "Q1")

    def test_region_summary(self):
        response = self.client.get("/summary/region/Europe")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["region"], "Europe")

if __name__ == "__main__":
    unittest.main()
