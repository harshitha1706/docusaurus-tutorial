# Databricks Data Engineering: Foundations and Core Concepts

## Introduction to the Databricks Lakehouse Platform

The Databricks Lakehouse Platform combines the best features of data lakes and data warehouses to provide a unified solution for data engineering, analytics, and machine learning. This training material covers essential concepts and practical techniques for developing data pipelines on this platform.

### What is the Lakehouse Architecture?

The Lakehouse architecture addresses the limitations of traditional data lakes and warehouses by offering:

- **ACID transactions** - Ensuring data consistency and reliability
- **Schema enforcement and governance** - Maintaining data quality
- **BI support** - Enabling direct analytics on the data lake
- **Decoupled storage and compute** - Providing cost efficiency and scalability
- **Open formats** - Preventing vendor lock-in with formats like Delta Lake

### Databricks Workspace Components

- **Notebooks** - Collaborative environment for code development
- **Clusters** - Scalable compute resources for processing
- **Jobs** - Scheduled execution of workflows
- **Repos** - Git-based version control integration
- **SQL Warehouses** - Dedicated compute for SQL analytics
- **Unity Catalog** - Unified governance layer for data assets

## Day 1: Core Data Engineering Concepts

### 1. Delta Lake

Delta Lake is an open-source storage layer that brings reliability to data lakes. It provides ACID transactions, scalable metadata handling, and unifies streaming and batch data processing.

#### Key Delta Lake Features

**Creating Delta Tables:**

```sql
-- Creating a managed Delta table
CREATE TABLE customer_data (
  id INT,
  name STRING,
  email STRING,
  signup_date DATE
)

-- Creating an external Delta table
CREATE TABLE transactions
LOCATION '/mnt/data/transactions'
AS SELECT * FROM parquet.`/mnt/raw-data/transactions`

-- Converting an existing table to Delta
CONVERT TO DELTA parquet.`/mnt/data/events`
```

**Time Travel:**

Delta Lake maintains a history of changes, allowing you to query data as it appeared at a specific point in time.

```sql
-- Query data as of a timestamp
SELECT * FROM customer_data TIMESTAMP AS OF '2023-01-01'

-- Query data as of a version number
SELECT * FROM customer_data VERSION AS OF 5
```

**Optimization Commands:**

```sql
-- Compact small files
OPTIMIZE customer_data

-- Z-order optimization for query performance
OPTIMIZE customer_data ZORDER BY (id, signup_date)

-- Vacuum old files (default retention: 7 days)
VACUUM customer_data
```

#### Hands-on Exercise: Working with Delta Tables

1. Create a Delta table from sample data
2. Perform updates and deletes on the table
3. View the table history
4. Query previous versions
5. Optimize the table for better performance

### 2. Relational Entities on Databricks

Databricks organizes data using familiar relational database concepts while leveraging the scalable cloud storage underneath.

#### Databases and Tables

```sql
-- Create a database
CREATE DATABASE retail_analytics
LOCATION '/mnt/data/retail'

-- Create a table with partitioning
CREATE TABLE retail_analytics.sales (
  transaction_id STRING,
  product_id STRING,
  customer_id STRING,
  store_id STRING,
  quantity INT,
  price DOUBLE,
  transaction_date DATE
)
PARTITIONED BY (transaction_date)
```

#### Views and Temporary Views

```sql
-- Create a view
CREATE VIEW retail_analytics.daily_sales AS
SELECT transaction_date, SUM(quantity * price) AS daily_revenue
FROM retail_analytics.sales
GROUP BY transaction_date

-- Create a temporary view (session-scoped)
CREATE TEMP VIEW recent_sales AS
SELECT * FROM retail_analytics.sales
WHERE transaction_date >= current_date() - INTERVAL 30 DAYS
```

#### Hands-on Exercise: Creating a Data Model

1. Design a star schema for a retail analytics use case
2. Create dimension and fact tables
3. Implement appropriate partitioning strategies
4. Create views for common access patterns

### 3. ETL with Spark SQL

Spark SQL is a powerful tool for data transformation within the Databricks environment, offering both performance and ease of use.

#### Data Extraction

```sql
-- Reading from cloud storage (CSV)
CREATE TABLE raw_customer_data
USING CSV
OPTIONS (
  path = '/mnt/raw/customers.csv',
  header = 'true',
  inferSchema = 'true'
)

-- Reading from JDBC source
CREATE TABLE raw_orders
USING org.apache.spark.sql.jdbc
OPTIONS (
  url = 'jdbc:postgresql://server:5432/database',
  dbtable = 'orders',
  user = '${user}',
  password = '${password}'
)
```

#### Data Transformation

```sql
-- Basic transformations
CREATE TABLE transformed_customers AS
SELECT 
  id,
  UPPER(first_name) AS first_name,
  UPPER(last_name) AS last_name,
  email,
  CASE
    WHEN age < 18 THEN 'Under 18'
    WHEN age BETWEEN 18 AND 35 THEN 'Young Adult'
    WHEN age BETWEEN 36 AND 65 THEN 'Adult'
    ELSE 'Senior'
  END AS age_group
FROM raw_customer_data

-- Window functions
CREATE TABLE customer_purchase_stats AS
SELECT
  customer_id,
  order_date,
  order_amount,
  SUM(order_amount) OVER (PARTITION BY customer_id ORDER BY order_date) AS running_total,
  AVG(order_amount) OVER (PARTITION BY customer_id ORDER BY order_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg_3_orders
FROM raw_orders
```

#### Data Loading

```sql
-- Merge operation (upsert)
MERGE INTO customers target
USING customer_updates source
ON target.id = source.id
WHEN MATCHED THEN
  UPDATE SET
    target.email = source.email,
    target.address = source.address,
    target.updated_at = current_timestamp()
WHEN NOT MATCHED THEN
  INSERT (id, first_name, last_name, email, address, created_at, updated_at)
  VALUES (source.id, source.first_name, source.last_name, source.email, source.address, current_timestamp(), current_timestamp())
```

#### Hands-on Exercise: Building an ETL Pipeline

1. Extract data from multiple sources
2. Implement transformations including cleaning, enrichment and aggregation
3. Load data into target Delta tables
4. Implement quality checks and error handling

### 4. Just Enough Python for Spark SQL

While Spark SQL is powerful, Python can extend its capabilities for more complex transformations and control flow.

#### PySpark Basics

```python
# Create a DataFrame
from pyspark.sql import functions as F

# Read data
df = spark.read.format("delta").table("retail_analytics.sales")

# Transformation with Python functions
df_transformed = df.withColumn("revenue", F.col("quantity") * F.col("price")) \
                   .withColumn("transaction_month", F.date_format("transaction_date", "yyyy-MM")) \
                   .filter(F.col("revenue") > 100)

# Write back to a Delta table
df_transformed.write.format("delta").mode("overwrite").saveAsTable("retail_analytics.high_value_sales")
```

#### Custom Functions with Python UDFs

```python
# Define a Python function
from pyspark.sql.functions import udf
from pyspark.sql.types import StringType

@udf(returnType=StringType())
def generate_customer_segment(recency, frequency, monetary):
    score = 0
    if recency < 30: score += 3
    elif recency < 90: score += 2
    else: score += 1
    
    if frequency > 10: score += 3
    elif frequency > 5: score += 2
    else: score += 1
    
    if monetary > 1000: score += 3
    elif monetary > 500: score += 2
    else: score += 1
    
    segments = {
        3: "Low Value", 
        4: "Low Value",
        5: "Medium Value",
        6: "Medium Value",
        7: "High Value",
        8: "High Value",
        9: "High Value"
    }
    
    return segments.get(score, "Unknown")

# Apply UDF to DataFrame
df_with_segments = df.withColumn("customer_segment", 
                                 generate_customer_segment(
                                     F.col("days_since_last_purchase"),
                                     F.col("purchase_count"),
                                     F.col("total_spend")
                                 ))
```

#### Combining SQL and Python

```python
# Execute SQL within Python
top_products_df = spark.sql("""
  SELECT 
    product_id,
    SUM(quantity) as total_sold,
    SUM(quantity * price) as total_revenue
  FROM retail_analytics.sales
  GROUP BY product_id
  ORDER BY total_revenue DESC
  LIMIT 10
""")

# Process results with Python
for product in top_products_df.collect():
    print(f"Product {product.product_id}: Sold {product.total_sold} units, Revenue: ${product.total_revenue:.2f}")
    
# Create temporary view from Python DataFrame
df_customer_segments.createOrReplaceTempView("customer_segments")

# Use the temporary view in SQL
spark.sql("""
  SELECT 
    customer_segment,
    COUNT(*) as customer_count,
    AVG(total_spend) as avg_spend
  FROM customer_segments
  GROUP BY customer_segment
  ORDER BY avg_spend DESC
""").show()
```

#### Hands-on Exercise: Extending SQL with Python

1. Implement a complex data cleaning routine using Python UDFs
2. Create a customer segmentation model with Python logic
3. Generate a report combining SQL aggregations and Python processing
4. Build a pipeline that alternates between SQL and Python steps

### 5. Incremental Data Processing with Structured Streaming and Auto Loader

Databricks provides powerful tools for handling streaming data and incremental file ingestion.

#### Structured Streaming

```python
# Create a streaming DataFrame from a source
from pyspark.sql.functions import *

stream_df = spark.readStream.format("kafka") \
    .option("kafka.bootstrap.servers", "kafka-server:9092") \
    .option("subscribe", "events_topic") \
    .option("startingOffsets", "latest") \
    .load()

# Parse the JSON payload
parsed_df = stream_df.select(
    col("key").cast("string"),
    from_json(col("value").cast("string"), event_schema).alias("event"),
    col("timestamp")
)

# Extract fields from the nested structure
processed_df = parsed_df.select(
    "key",
    "timestamp",
    "event.user_id",
    "event.event_type",
    "event.item_id",
    "event.properties"
)

# Write the stream to a Delta table
query = processed_df.writeStream \
    .format("delta") \
    .outputMode("append") \
    .option("checkpointLocation", "/mnt/checkpoints/events") \
    .table("events_streaming")
```

#### Auto Loader

Auto Loader provides a simpler way to incrementally ingest new files as they arrive in cloud storage.

```python
# Configure Auto Loader to incrementally load new files
df_autoloader = spark.readStream.format("cloudFiles") \
    .option("cloudFiles.format", "csv") \
    .option("cloudFiles.schemaLocation", "/mnt/schema/customer_files") \
    .option("cloudFiles.inferColumnTypes", "true") \
    .load("/mnt/landing/customer_files/")

# Process and write to Delta table
df_autoloader.writeStream \
    .format("delta") \
    .option("checkpointLocation", "/mnt/checkpoints/customer_files") \
    .trigger(once=True)  # Process available files and stop
    .table("customers_incremental")
```

#### Hands-on Exercise: Implementing Incremental Processing

1. Set up Auto Loader to ingest new CSV files
2. Implement schema evolution handling
3. Create a streaming pipeline for data transformation
4. Configure checkpointing and failure recovery
5. Implement an incremental update to a reporting table

## Day 2: Advanced Data Engineering

### 1. Medallion Architecture in the Data Lakehouse

The Medallion architecture is a data design pattern used in the Lakehouse that organizes data into different quality tiers: Bronze (raw), Silver (validated), and Gold (aggregated/business-level).

#### Bronze Layer

The Bronze layer contains raw, unmodified data from source systems:

```sql
-- Create a Bronze table
CREATE TABLE bronze_retail_transactions (
  payload STRING,  -- Raw JSON
  source_file STRING,
  ingestion_time TIMESTAMP
)
LOCATION '/mnt/lakehouse/bronze/retail_transactions'

-- Ingest data into Bronze
INSERT INTO bronze_retail_transactions
SELECT 
  raw_payload,
  input_file_name() AS source_file,
  current_timestamp() AS ingestion_time
FROM raw_retail_transactions
```

#### Silver Layer

The Silver layer contains cleansed, validated data in a more structured format:

```sql
-- Create a Silver table with schema enforcement
CREATE TABLE silver_retail_transactions (
  transaction_id STRING,
  store_id STRING,
  customer_id STRING,
  transaction_date DATE,
  items ARRAY<STRUCT<item_id: STRING, quantity: INT, price: DOUBLE>>,
  total_amount DOUBLE,
  payment_method STRING,
  ingestion_time TIMESTAMP,
  processing_time TIMESTAMP,
  source_file STRING
)
LOCATION '/mnt/lakehouse/silver/retail_transactions'

-- Transform Bronze to Silver with validation
INSERT INTO silver_retail_transactions
SELECT
  get_json_object(payload, '$.transaction_id') AS transaction_id,
  get_json_object(payload, '$.store_id') AS store_id,
  get_json_object(payload, '$.customer_id') AS customer_id,
  to_date(get_json_object(payload, '$.transaction_date')) AS transaction_date,
  from_json(get_json_object(payload, '$.items'), 'ARRAY<STRUCT<item_id: STRING, quantity: INT, price: DOUBLE>>') AS items,
  cast(get_json_object(payload, '$.total_amount') AS DOUBLE) AS total_amount,
  get_json_object(payload, '$.payment_method') AS payment_method,
  ingestion_time,
  current_timestamp() AS processing_time,
  source_file
FROM bronze_retail_transactions
WHERE get_json_object(payload, '$.transaction_id') IS NOT NULL
  AND to_date(get_json_object(payload, '$.transaction_date')) IS NOT NULL
  AND cast(get_json_object(payload, '$.total_amount') AS DOUBLE) > 0
```

#### Gold Layer

The Gold layer contains business-level aggregations and derived tables:

```sql
-- Create a Gold table for daily store performance
CREATE TABLE gold_daily_store_performance (
  store_id STRING,
  transaction_date DATE,
  transaction_count BIGINT,
  total_revenue DOUBLE,
  unique_customers BIGINT,
  avg_basket_size DOUBLE,
  avg_transaction_value DOUBLE,
  processing_time TIMESTAMP
)
LOCATION '/mnt/lakehouse/gold/daily_store_performance'

-- Aggregate Silver to Gold
INSERT INTO gold_daily_store_performance
SELECT
  store_id,
  transaction_date,
  COUNT(*) AS transaction_count,
  SUM(total_amount) AS total_revenue,
  COUNT(DISTINCT customer_id) AS unique_customers,
  AVG(array_size(items)) AS avg_basket_size,
  AVG(total_amount) AS avg_transaction_value,
  current_timestamp() AS processing_time
FROM silver_retail_transactions
GROUP BY store_id, transaction_date
```

#### Hands-on Exercise: Implementing a Medallion Architecture

1. Set up Bronze tables to capture raw data from different sources
2. Implement Silver layer transformation with data validation
3. Create Gold tables for business metrics
4. Design incremental updates across all layers
5. Add data quality monitoring between layers

### 2. Delta Live Tables

Delta Live Tables (DLT) provides a declarative framework for building reliable, maintainable, and testable data pipelines.

#### Python API for DLT

```python
import dlt
from pyspark.sql import functions as F

# Bronze layer table
@dlt.table(
  name="bronze_customers",
  comment="Raw customer data from source system",
  table_properties={"quality": "bronze"}
)
def bronze_customers():
  return (
    spark.readStream.format("cloudFiles")
      .option("cloudFiles.format", "json")
      .load("/mnt/landing/customers/")
  )

# Silver layer table with expectations
@dlt.table(
  name="silver_customers",
  comment="Cleansed customer records",
  table_properties={"quality": "silver"}
)
@dlt.expect_all({
  "valid_email": "email IS NOT NULL AND email LIKE '%@%.%'",
  "valid_age": "age > 0 AND age < 120"
})
def silver_customers():
  return (
    dlt.read_stream("bronze_customers")
      .select(
        F.col("customer_id"),
        F.lower(F.col("email")).alias("email"),
        F.initcap(F.col("first_name")).alias("first_name"),
        F.initcap(F.col("last_name")).alias("last_name"),
        F.col("age"),
        F.to_date(F.col("signup_date")).alias("signup_date")
      )
  )

# Gold layer table
@dlt.table(
  name="gold_customer_demographics",
  comment="Customer demographics for analysis",
  table_properties={"quality": "gold"}
)
def gold_customer_demographics():
  return (
    dlt.read("silver_customers")
      .groupBy(
        F.floor(F.col("age") / 10) * 10
      )
      .agg(
        F.count("*").alias("customer_count"),
        F.avg("age").alias("average_age"),
        F.min("signup_date").alias("earliest_signup"),
        F.max("signup_date").alias("latest_signup")
      )
      .withColumnRenamed("(floor((age / 10)) * 10)", "age_bracket")
  )
```

#### SQL API for DLT

```sql
-- Bronze layer in SQL
CREATE OR REFRESH STREAMING LIVE TABLE bronze_transactions
COMMENT "Raw transaction data from source system"
TBLPROPERTIES ("quality" = "bronze")
AS SELECT * FROM cloud_files(
  '/mnt/landing/transactions/',
  'json'
);

-- Silver layer with expectations
CREATE OR REFRESH STREAMING LIVE TABLE silver_transactions (
  CONSTRAINT valid_amount EXPECT (amount > 0),
  CONSTRAINT valid_transaction_date EXPECT (transaction_date > '2020-01-01')
)
COMMENT "Validated transaction records"
TBLPROPERTIES ("quality" = "silver")
AS
  SELECT
    transaction_id,
    customer_id,
    CAST(amount AS DOUBLE) AS amount,
    to_date(transaction_date) AS transaction_date,
    store_id,
    payment_method,
    current_timestamp() AS processing_time
  FROM STREAM(LIVE.bronze_transactions)
  WHERE transaction_id IS NOT NULL;

-- Gold layer
CREATE OR REFRESH LIVE TABLE gold_monthly_revenue
COMMENT "Monthly revenue by store"
TBLPROPERTIES ("quality" = "gold")
AS
  SELECT
    store_id,
    date_format(transaction_date, 'yyyy-MM') AS month,
    COUNT(*) AS transaction_count,
    SUM(amount) AS total_revenue,
    COUNT(DISTINCT customer_id) AS unique_customers
  FROM LIVE.silver_transactions
  GROUP BY store_id, date_format(transaction_date, 'yyyy-MM');
```

#### Hands-on Exercise: Building a DLT Pipeline

1. Design a DLT pipeline for a retail use case
2. Implement both Python and SQL versions
3. Add data quality expectations
4. Configure pipeline settings
5. Monitor pipeline execution and data quality metrics

### 3. Task Orchestration with Databricks Jobs

Databricks Jobs provides a way to schedule and orchestrate complex workflows.

#### Creating and Scheduling Jobs

Jobs can be created through the UI or API:

```python
# Using the Databricks Jobs API to create a job
import requests
import json

url = f"https://<databricks-instance>/api/2.1/jobs/create"
headers = {
  "Authorization": f"Bearer {token}",
  "Content-Type": "application/json"
}

job_config = {
  "name": "Retail Analytics Pipeline",
  "tasks": [
    {
      "task_key": "ingest_data",
      "notebook_task": {
        "notebook_path": "/Repos/team/project/notebooks/ingest_data",
        "source": "WORKSPACE"
      },
      "job_cluster_key": "processing_cluster",
      "timeout_seconds": 3600
    },
    {
      "task_key": "transform_data",
      "notebook_task": {
        "notebook_path": "/Repos/team/project/notebooks/transform_data",
        "source": "WORKSPACE",
        "base_parameters": {
          "date": "{{start_time | date: 'yyyy-MM-dd'}}"
        }
      },
      "job_cluster_key": "processing_cluster",
      "depends_on": [
        {
          "task_key": "ingest_data"
        }
      ]
    },
    {
      "task_key": "generate_reports",
      "notebook_task": {
        "notebook_path": "/Repos/team/project/notebooks/generate_reports",
        "source": "WORKSPACE"
      },
      "job_cluster_key": "reporting_cluster",
      "depends_on": [
        {
          "task_key": "transform_data"
        }
      ]
    }
  ],
  "job_clusters": [
    {
      "job_cluster_key": "processing_cluster",
      "new_cluster": {
        "spark_version": "11.3.x-scala2.12",
        "node_type_id": "Standard_DS3_v2",
        "num_workers": 2,
        "spark_conf": {
          "spark.speculation": "true"
        }
      }
    },
    {
      "job_cluster_key": "reporting_cluster",
      "new_cluster": {
        "spark_version": "11.3.x-scala2.12",
        "node_type_id": "Standard_DS3_v2",
        "num_workers": 1
      }
    }
  ],
  "schedule": {
    "quartz_cron_expression": "0 0 0 * * ?",  # Daily at midnight
    "timezone_id": "UTC"
  },
  "max_concurrent_runs": 1
}

response = requests.post(url, headers=headers, data=json.dumps(job_config))
print(json.dumps(response.json(), indent=2))
```

#### Job Parameters and Dynamic Values

Jobs can use parameters to make workflows more flexible:

- Static parameters defined in job config
- Runtime parameters specified when triggering jobs manually
- Dynamic parameters using date expressions: `{{start_time | date: 'yyyy-MM-dd'}}`

#### Error Handling and Notifications

```python
# Job configuration with notifications and retry settings
job_config = {
  # ... other job configuration ...
  "email_notifications": {
    "on_success": ["success@example.com"],
    "on_failure": ["alerts@example.com"],
    "no_alert_for_skipped_runs": True
  },
  "webhook_notifications": {
    "on_failure": [
      {
        "id": "webhook-id"
      }
    ]
  },
  "retry_on_timeout": True,
  "max_retries": 3,
  "min_retry_interval_millis": 300000  # 5 minutes
}
```

#### Hands-on Exercise: Orchestrating Workflows

1. Design a multi-stage ETL workflow
2. Create a job with task dependencies
3. Configure appropriate clusters for each task
4. Set up scheduling and parameters
5. Implement error handling and notifications
6. Test job execution and monitoring

### 4. Databricks SQL

Databricks SQL provides a way to query data in the lakehouse and build dashboards for analytics.

#### Creating and Optimizing SQL Warehouses

SQL Warehouses provide dedicated compute resources for SQL workloads:

- **Size**: Choose based on query complexity and concurrency requirements
- **Auto-stop**: Configure idle shutdown to optimize costs
- **Scaling**: Set min/max clusters for elastic workloads
- **Spot instances**: Use for non-critical workloads to reduce costs

#### Writing Efficient Queries

```sql
-- Use query optimization hints
SELECT /*+ BROADCAST(s) */ 
  c.customer_id,
  c.name,
  SUM(s.amount) as total_purchases
FROM customers c
JOIN sales s ON c.customer_id = s.customer_id
GROUP BY c.customer_id, c.name;

-- Leverage materialized views for common query patterns
CREATE MATERIALIZED VIEW daily_sales_by_region
AS
SELECT 
  region,
  transaction_date,
  SUM(amount) as daily_sales
FROM sales s
JOIN stores st ON s.store_id = st.store_id
GROUP BY region, transaction_date;
```

#### Building Dashboards

Databricks SQL allows you to create interactive dashboards:

1. Create queries that produce visualization-ready results
2. Add visualizations (charts, tables, counters, etc.)
3. Organize visualizations on dashboards
4. Schedule dashboard refreshes
5. Share dashboards with stakeholders

#### Hands-on Exercise: Analytics with Databricks SQL

1. Create optimized queries for business reporting
2. Build visualizations for key metrics
3. Create a dashboard with multiple visualizations
4. Configure dashboard parameters for interactive filtering
5. Set up scheduled refreshes and alerts

### 5. Managing Permissions in the Lakehouse

Security is a critical aspect of data engineering. Databricks provides robust access control mechanisms.

#### Unity Catalog

Unity Catalog provides a unified governance solution for data:

```sql
-- Create a catalog
CREATE CATALOG IF NOT EXISTS retail;

-- Create a schema
CREATE SCHEMA IF NOT EXISTS retail.sales;

-- Grant permissions
GRANT USAGE ON CATALOG retail TO `data_analysts`;
GRANT USAGE ON SCHEMA retail.sales TO `data_analysts`;
GRANT SELECT ON TABLE retail.sales.transactions TO `data_analysts`;

-- Create a user with specific permissions
CREATE USER user1 WITH PASSWORD 'password';
ALTER USER user1 SET ROLE data_engineer;
```

#### Table Access Control

```sql
-- Grant specific permissions
GRANT SELECT ON TABLE customers TO `analysts`;
GRANT MODIFY ON TABLE customers TO `data_engineers`;

-- Column-level security
GRANT SELECT (customer_id, name, city, state) ON TABLE customers TO `marketing`;
```

#### Dynamic Views for Row-Level Security

```sql
-- Create a secure view for row-level filtering
CREATE VIEW sales_by_region AS
SELECT *
FROM sales
WHERE region IN (SELECT allowed_regions FROM user_permissions WHERE username = current_user());
```

#### Hands-on Exercise: Implementing Security

1. Set up a Unity Catalog with multiple catalogs and schemas
2. Create role-based access controls
3. Implement column-level security for sensitive data
4. Create secure views for row-level filtering
5. Audit and monitor access patterns

### 6. Productionizing Dashboards and Queries on Databricks SQL

Moving dashboards and queries to production requires attention to performance, reliability, and usability.

#### Query Optimization Techniques

```sql
-- Create an optimized table for analytics
CREATE TABLE sales_analytics
USING DELTA
PARTITIONED BY (transaction_date)
CLUSTERED BY (customer_id) INTO 50 BUCKETS
AS
SELECT * FROM sales;

-- Z-order optimization
OPTIMIZE sales_analytics
ZORDER BY (store_id, product_id);
```

#### Alerts and Scheduled Queries

```sql
-- Create a scheduled query
-- (Usually done through the UI, but can be scripted via API)
SELECT
  current_date() AS check_date,
  COUNT(*) AS error_count
FROM transaction_logs
WHERE status = 'ERROR'
  AND log_date = current_date()
```

Configure alerts:
- Threshold-based (trigger when value exceeds threshold)
- Change-based (trigger on significant changes)
- Delivery via email, Slack, or webhooks

#### Dashboard Parameters and Interactivity

Create dynamic dashboards with:
- **Query parameters**: Allow users to filter data
- **Parameter mapping**: Connect widgets to query parameters
- **Cross-filtering**: Select data in one visual to filter others

#### Hands-on Exercise: Production-Ready Analytics

1. Optimize tables for analytical queries
2. Set up scheduled queries for regular reporting
3. Configure alerts for anomaly detection
4. Create interactive dashboards with parameters
5. Implement access controls for dashboards and queries

## Summary and Additional Resources

This training covered essential concepts and techniques for data engineering on the Databricks Lakehouse Platform:

- Delta Lake for reliable and performant data storage
- ETL with Spark SQL and Python
- Incremental data processing with Structured Streaming and Auto Loader
- Medallion architecture for organizing data
- Delta Live Tables for declarative pipeline development
- Job orchestration for workflow automation
- Databricks SQL for analytics and visualization
- Security and access control

### Learning Resources

- [Databricks Documentation](https://docs.databricks.com/)
- [Delta Lake Documentation](https://delta.io/docs/)
- [Spark SQL Reference](https://spark.apache.org/docs/latest/sql-ref.html)
- [Databricks Academy](https://www.databricks.com/learn/training/)
- [Databricks Tech Talks](https://databricks.com/resources/type/tech-talks)

### Next Steps

After completing this training, consider:

1. Pursuing Databricks Data Engineer Associate certification
2. Exploring advanced optimizations and best practices
3. Implementing CI/CD for Databricks workflows
4. Integrating ML pipelines into your data workflows
