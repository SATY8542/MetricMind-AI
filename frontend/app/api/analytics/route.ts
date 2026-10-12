import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CUBE_URL = process.env.CUBE_API_URL || "http://localhost:4000";

const ALLOWED_MEASURES = new Set([
  "Sales.totalRevenue",
  "Sales.totalProfit",
  "Sales.totalOrders",
  "Sales.totalCost",
  "Sales.totalUnitsSold",
  "Sales.averageMargin",
]);

const ALLOWED_DIMENSIONS = new Set([
  "Sales.year",
  "Sales.quarter",
  "Sales.region",
  "Sales.country",
  "Sales.product",
  "Sales.channel",
]);

const ALLOWED_OPERATORS = new Set([
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "gt",
  "gte",
  "lt",
  "lte",
  "set",
  "notSet",
]);

interface CubeFilter {
  member: string;
  operator: string;
  values?: (string | number)[];
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body.query !== "object" ||
      body.query === null ||
      Array.isArray(body.query)
    ) {
      return NextResponse.json(
        { error: "A valid 'query' object is required in the request body." },
        { status: 400 }
      );
    }

    const rawQuery = body.query as Record<string, unknown>;

    // Validate measures
    const validatedMeasures: string[] = [];
    if (rawQuery.measures !== undefined) {
      if (!Array.isArray(rawQuery.measures)) {
        return NextResponse.json(
          { error: "'measures' must be an array of measure names." },
          { status: 400 }
        );
      }
      for (const m of rawQuery.measures) {
        if (typeof m !== "string" || !ALLOWED_MEASURES.has(m)) {
          return NextResponse.json(
            {
              error: `Unsupported measure '${m}'. Supported measures: ${Array.from(ALLOWED_MEASURES).join(", ")}`,
            },
            { status: 400 }
          );
        }
        validatedMeasures.push(m);
      }
    }

    // Validate dimensions
    const validatedDimensions: string[] = [];
    if (rawQuery.dimensions !== undefined) {
      if (!Array.isArray(rawQuery.dimensions)) {
        return NextResponse.json(
          { error: "'dimensions' must be an array of dimension names." },
          { status: 400 }
        );
      }
      for (const d of rawQuery.dimensions) {
        if (typeof d !== "string" || !ALLOWED_DIMENSIONS.has(d)) {
          return NextResponse.json(
            {
              error: `Unsupported dimension '${d}'. Supported dimensions: ${Array.from(ALLOWED_DIMENSIONS).join(", ")}`,
            },
            { status: 400 }
          );
        }
        validatedDimensions.push(d);
      }
    }

    if (validatedMeasures.length === 0 && validatedDimensions.length === 0) {
      return NextResponse.json(
        { error: "At least one valid measure or dimension must be requested." },
        { status: 400 }
      );
    }

    // Validate filters
    const validatedFilters: CubeFilter[] = [];
    if (rawQuery.filters !== undefined) {
      if (!Array.isArray(rawQuery.filters)) {
        return NextResponse.json(
          { error: "'filters' must be an array of filter objects." },
          { status: 400 }
        );
      }
      for (const f of rawQuery.filters) {
        if (!f || typeof f !== "object" || Array.isArray(f)) {
          return NextResponse.json(
            { error: "Each filter must be an object." },
            { status: 400 }
          );
        }
        const member = (f as Record<string, unknown>).member;
        const operator = (f as Record<string, unknown>).operator;
        const values = (f as Record<string, unknown>).values;

        if (
          typeof member !== "string" ||
          (!ALLOWED_DIMENSIONS.has(member) && !ALLOWED_MEASURES.has(member))
        ) {
          return NextResponse.json(
            {
              error: `Unsupported filter member '${member}'. Allowed members: ${[...ALLOWED_DIMENSIONS, ...ALLOWED_MEASURES].join(", ")}`,
            },
            { status: 400 }
          );
        }

        if (typeof operator !== "string" || !ALLOWED_OPERATORS.has(operator)) {
          return NextResponse.json(
            {
              error: `Unsupported filter operator '${operator}'. Allowed operators: ${Array.from(ALLOWED_OPERATORS).join(", ")}`,
            },
            { status: 400 }
          );
        }

        let cleanValues: (string | number)[] | undefined = undefined;
        if (values !== undefined) {
          if (!Array.isArray(values)) {
            return NextResponse.json(
              { error: "Filter 'values' must be an array." },
              { status: 400 }
            );
          }
          cleanValues = values.map((v) =>
            typeof v === "number" ? v : String(v)
          );
        }

        validatedFilters.push({
          member,
          operator,
          values: cleanValues,
        });
      }
    }

    // Validate order
    let validatedOrder: Record<string, "asc" | "desc"> | undefined = undefined;
    if (rawQuery.order !== undefined) {
      if (
        typeof rawQuery.order === "object" &&
        rawQuery.order !== null &&
        !Array.isArray(rawQuery.order)
      ) {
        const orderObj = rawQuery.order as Record<string, unknown>;
        validatedOrder = {};
        for (const [key, dir] of Object.entries(orderObj)) {
          if (!ALLOWED_MEASURES.has(key) && !ALLOWED_DIMENSIONS.has(key)) {
            return NextResponse.json(
              { error: `Invalid order key '${key}'.` },
              { status: 400 }
            );
          }
          const lowerDir = String(dir).toLowerCase();
          if (lowerDir !== "asc" && lowerDir !== "desc") {
            return NextResponse.json(
              { error: `Order direction must be 'asc' or 'desc'.` },
              { status: 400 }
            );
          }
          validatedOrder[key] = lowerDir as "asc" | "desc";
        }
      }
    }

    // Validate limit
    let validatedLimit: number | undefined = undefined;
    if (rawQuery.limit !== undefined) {
      const numLimit = Number(rawQuery.limit);
      if (Number.isInteger(numLimit) && numLimit > 0 && numLimit <= 10000) {
        validatedLimit = numLimit;
      } else {
        return NextResponse.json(
          { error: "'limit' must be an integer between 1 and 10000." },
          { status: 400 }
        );
      }
    }

    // Construct clean validated query payload
    const sanitizedQuery: Record<string, unknown> = {};
    if (validatedMeasures.length > 0) sanitizedQuery.measures = validatedMeasures;
    if (validatedDimensions.length > 0) sanitizedQuery.dimensions = validatedDimensions;
    if (validatedFilters.length > 0) sanitizedQuery.filters = validatedFilters;
    if (validatedOrder) sanitizedQuery.order = validatedOrder;
    if (validatedLimit !== undefined) sanitizedQuery.limit = validatedLimit;

    // Fetch load data and genuine SQL from Cube
    const [loadResponse, sqlResponse] = await Promise.allSettled([
      fetch(`${CUBE_URL}/cubejs-api/v1/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sanitizedQuery }),
        cache: "no-store",
      }),
      fetch(`${CUBE_URL}/cubejs-api/v1/sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sanitizedQuery }),
        cache: "no-store",
      }),
    ]);

    if (loadResponse.status === "rejected") {
      console.error("Cube connection error:", loadResponse.reason);
      return NextResponse.json(
        {
          error: `Unable to connect to the Cube analytics service at ${CUBE_URL}. Please verify that Cube is running.`,
        },
        { status: 502 }
      );
    }

    const loadRes = loadResponse.value;
    const loadJson = await loadRes.json();

    if (!loadRes.ok) {
      return NextResponse.json(
        {
          error: loadJson?.error || "Cube query failed.",
        },
        { status: loadRes.status }
      );
    }

    let genuineSql: string | undefined = undefined;
    if (sqlResponse.status === "fulfilled" && sqlResponse.value.ok) {
      try {
        const sqlJson = await sqlResponse.value.json();
        if (Array.isArray(sqlJson?.sql?.sql) && sqlJson.sql.sql[0]) {
          genuineSql = String(sqlJson.sql.sql[0]);
        }
      } catch {
        // SQL is optional; do not fail if unparseable
      }
    }

    return NextResponse.json({
      data: loadJson.data ?? [],
      query: sanitizedQuery,
      sql: genuineSql,
      annotation: loadJson.annotation,
    });
  } catch (error) {
    console.error("Cube analytics API unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal analytics proxy error occurred.",
      },
      { status: 500 }
    );
  }
}
