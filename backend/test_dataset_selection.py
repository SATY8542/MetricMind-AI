import unittest
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from migrate_db import get_db
from analytics import get_kpi_overview, get_breakdowns, get_trends
from importer import get_available_datasets, set_active_dataset

class TestDatasetSelection(unittest.TestCase):
    ORG_ID = "org_metricmind_demo"
    SAMPLE_DATASET_ID = "ds_b04967f619e0"
    DEMO_DATASET_ID = "ds_demo_corporate"

    def test_available_datasets_list(self):
        data = get_available_datasets(self.ORG_ID)
        self.assertIn("datasets", data)
        datasets = data["datasets"]
        self.assertGreaterEqual(len(datasets), 2)
        dataset_ids = [d["id"] for d in datasets]
        self.assertIn(self.SAMPLE_DATASET_ID, dataset_ids)
        self.assertIn(self.DEMO_DATASET_ID, dataset_ids)

    def test_sample_50_orders_isolation(self):
        # Explicitly query metrics for the sample 50 orders dataset
        kpi = get_kpi_overview(self.ORG_ID, dataset_id=self.SAMPLE_DATASET_ID)
        
        # Verify exact counts and values derived from the 50 CSV rows
        self.assertEqual(kpi["total_orders"], 50)
        self.assertEqual(kpi["active_dataset"]["id"], self.SAMPLE_DATASET_ID)
        self.assertEqual(kpi["active_dataset"]["row_count"], 50)
        
        # Exact mathematical validation from sample_50_orders.csv
        # 50 rows sum up to $9,396,120.98 revenue and $2,772,170.13 profit
        self.assertAlmostEqual(kpi["total_revenue"], 9396120.98, places=2)
        self.assertAlmostEqual(kpi["total_profit"], 2772170.13, places=2)
        self.assertAlmostEqual(kpi["total_costs"], 6623950.87, places=2)
        self.assertAlmostEqual(kpi["profit_margin_percent"], 29.50, places=2)
        self.assertEqual(kpi["units_sold"], 10866)

    def test_demo_corporate_dataset_isolation(self):
        # Query metrics for the demo corporate dataset (5,000 rows)
        kpi = get_kpi_overview(self.ORG_ID, dataset_id=self.DEMO_DATASET_ID)
        
        self.assertEqual(kpi["total_orders"], 5000)
        self.assertEqual(kpi["active_dataset"]["id"], self.DEMO_DATASET_ID)
        self.assertEqual(kpi["active_dataset"]["row_count"], 5000)
        self.assertGreater(kpi["total_revenue"], 1_000_000_000)

    def test_combined_dataset_option(self):
        # Query metrics with dataset_id="all" (combined)
        kpi = get_kpi_overview(self.ORG_ID, dataset_id="all")
        
        # Should combine 5,000 + 50 = 5,050
        self.assertEqual(kpi["total_orders"], 5050)
        self.assertEqual(kpi["active_dataset"]["id"], "all")
        self.assertEqual(kpi["active_dataset"]["row_count"], 5050)

    def test_active_dataset_switching(self):
        # Switch to demo
        res1 = set_active_dataset(self.ORG_ID, self.DEMO_DATASET_ID)
        self.assertEqual(res1["active_dataset_id"], self.DEMO_DATASET_ID)
        kpi_demo = get_kpi_overview(self.ORG_ID)  # defaults to active
        self.assertEqual(kpi_demo["total_orders"], 5000)

        # Switch back to sample 50
        res2 = set_active_dataset(self.ORG_ID, self.SAMPLE_DATASET_ID)
        self.assertEqual(res2["active_dataset_id"], self.SAMPLE_DATASET_ID)
        kpi_sample = get_kpi_overview(self.ORG_ID)  # defaults to active
        self.assertEqual(kpi_sample["total_orders"], 50)

    def test_breakdowns_respect_dataset(self):
        breakdowns = get_breakdowns(self.ORG_ID, dataset_id=self.SAMPLE_DATASET_ID)
        self.assertIn("regional_performance", breakdowns)
        self.assertIn("sales_by_channel", breakdowns)
        self.assertIn("top_products", breakdowns)
        # Sum of regional revenues should match total revenue for the 50 orders
        region_rev_sum = sum(r["revenue"] for r in breakdowns["regional_performance"])
        self.assertAlmostEqual(region_rev_sum, 9396120.98, places=2)

if __name__ == "__main__":
    unittest.main()
