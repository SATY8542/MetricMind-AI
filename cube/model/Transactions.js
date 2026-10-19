cube(`Transactions`, {
  sql_table: `public.raw_sales`,

  measures: {
    count: {
      type: `count`
    },

    revenue: {
      type: `sum`,
      sql: `${CUBE}.revenue`
    },

    profit: {
      type: `sum`,
      sql: `${CUBE}.profit`
    },

    totalCost: {
      type: `sum`,
      sql: `${CUBE}.total_cost`
    },

    materialCost: {
      type: `sum`,
      sql: `${CUBE}.material_cost`
    },

    shippingCost: {
      type: `sum`,
      sql: `${CUBE}.shipping_cost`
    },

    laborCost: {
      type: `sum`,
      sql: `${CUBE}.labor_cost`
    },

    marketingCost: {
      type: `sum`,
      sql: `${CUBE}.marketing_cost`
    },

    unitsSold: {
      type: `sum`,
      sql: `${CUBE}.units_sold`
    },

    averageMargin: {
      type: `number`,
      sql: `100.0 * SUM(${CUBE}.profit) / NULLIF(SUM(${CUBE}.revenue), 0)`
    }
  },

  dimensions: {
    orderId: {
      sql: `${CUBE}.order_id`,
      type: `string`,
      primaryKey: true
    },

    orderDate: {
      sql: `${CUBE}.order_date`,
      type: `time`
    },

    year: {
      sql: `${CUBE}.year`,
      type: `number`
    },

    quarter: {
      sql: `${CUBE}.quarter`,
      type: `string`
    },

    month: {
      sql: `${CUBE}.month`,
      type: `string`
    },

    region: {
      sql: `${CUBE}.region`,
      type: `string`
    },

    country: {
      sql: `${CUBE}.country`,
      type: `string`
    },

    product: {
      sql: `${CUBE}.product`,
      type: `string`
    },

    channel: {
      sql: `${CUBE}.channel`,
      type: `string`
    }
  }
});
