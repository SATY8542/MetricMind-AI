
select
    year,
    quarter,
    region,
    country,
    product,
    channel,
    count(*) as total_orders,
    sum(units_sold) as total_units_sold,
    sum(revenue) as total_revenue,
    sum(total_cost) as total_cost,
    sum(profit) as total_profit,
    case
        when sum(revenue) = 0 then 0
        else round(
            sum(profit) * 100.0 / sum(revenue),
            2
        )
    end as margin_percent
from {{ ref('stg_raw_sales') }}
group by
    year,
    quarter,
    region,
    country,
    product,
    channel
