import unittest
from parser import parse_question


class TestParser(unittest.TestCase):

    def test_revenue_by_country(self):
        query = parse_question("Show revenue by country")
        self.assertEqual(query.measures, ["Sales.revenue"])
        self.assertIn("Sales.country", query.dimensions)

    def test_revenue_for_india(self):
        query = parse_question("Show revenue for India")
        self.assertEqual(query.filters.get("Sales.country"), "India")

    def test_revenue_last_month(self):
        query = parse_question("Show revenue last month")
        self.assertEqual(query.measures, ["Sales.revenue"])
        self.assertEqual(query.time_range, "last month")

    def test_revenue_by_month(self):
        query = parse_question("Show revenue by month")
        self.assertIn("Sales.orderDate", query.dimensions)

    def test_unsupported_state(self):
        with self.assertRaises(ValueError):
            parse_question("Show revenue in Maharashtra")

    def test_missing_measure(self):
        with self.assertRaises(ValueError):
            parse_question("Show results by country")


if __name__ == "__main__":
    unittest.main()
