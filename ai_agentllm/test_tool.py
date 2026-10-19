import unittest
from unittest.mock import Mock, patch

from schemas import SemanticQuery
from tools import query_semantic_layer, get_date_range


class TestSemanticTools(unittest.TestCase):

    @patch("tools.requests.post")
    def test_revenue_query_payload(self, mock_post):
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "data": [{"Sales.revenue": "1000"}]
        }
        mock_post.return_value = mock_response

        query = SemanticQuery(
            measures=["Sales.revenue"],
            dimensions=["Sales.country"],
            filters={"Sales.country": "India"},
        )

        result = query_semantic_layer(query)

        self.assertEqual(result, [{"Sales.revenue": "1000"}])
        mock_post.assert_called_once()

        payload = mock_post.call_args.kwargs["json"]
        cube_query = payload["query"]

        self.assertEqual(cube_query["measures"], ["Sales.revenue"])
        self.assertEqual(cube_query["dimensions"], ["Sales.country"])
        self.assertEqual(
            cube_query["filters"][0]["member"],
            "Sales.country",
        )
        self.assertEqual(
            cube_query["filters"][0]["values"],
            ["India"],
        )

    def test_last_month_date_range(self):
        result = get_date_range("last month")

        self.assertEqual(len(result), 2)
        self.assertLessEqual(result[0], result[1])
        self.assertEqual(result[0][8:10], "01")

    def test_unknown_time_range(self):
        self.assertIsNone(get_date_range(None))


if __name__ == "__main__":
    unittest.main()
