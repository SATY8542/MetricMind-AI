from reasoning import get_comparison_data, calculate_change


metric = "profit"

data = get_comparison_data(
    metric=metric,
    state="Maharashtra"
)

result = calculate_change(
    data["july"],
    data["august"],
    metric
)

print(result)