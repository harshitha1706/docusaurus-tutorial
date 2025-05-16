# Advanced Data Engineering with Databricks: Optimization, Productionization, and CI/CD

This advanced training material focuses on optimizing Databricks data pipelines, implementing production-grade solutions, and establishing robust CI/CD practices for data engineering projects.

## 1. Optimizing Spark and Delta Lake Workloads

### Performance Tuning for Spark Applications

#### Cluster Configuration Optimization

Proper cluster sizing and configuration is crucial for performance:

```scala
// Example Cluster Configuration
{
  "num_workers": 10,
  "spark_version": "11.3.x-scala2.12",
  "node_type_id": "Standard_DS4_v2",
  "spark_conf": {
    "spark.databricks.delta.optimizeWrite.enabled": "true",
    "spark.databricks.delta.autoCompact.enabled": "true",
    "spark.sql.adaptive.enabled": "true",
    "spark.sql.adaptive.coalescePartitions.enabled": "true",
    "spark.sql.files.maxPartitionBytes": "134217728",
    "spark.sql.shuffle.partitions": "200"
  },
  "aws_attributes": {
    "instance_profile_arn": "arn:aws:iam::XXXXXXXXXXXX:instance-profile/databricks-role",
    "availability": "SPOT",
    "zone_id": "us-west-2a"
  },
  "autoscale": {
    "min_workers": 5,
    "max_workers": 20
  }
}
```

Key configuration considerations:
- **Worker type**: Choose based on workload (memory-optimized for large joins, compute-optimized for transformations)
- **Autoscaling**: Configure min/max workers based on workload variability
- **Spark parameters**: Tune based on data size and processing patterns

#### Query Optimization Techniques

Understanding the Spark execution plan is essential for optimization:

```python
# View the execution plan
df = spark.sql("SELECT * FROM sales JOIN customers ON sales.customer_id = customers.id")
df.explain(True)

# Analyze query metrics
df.select("customer_id", "amount").groupBy("customer_id").sum("amount").collect()
spark.sql("ANALYZE TABLE sales COMPUTE STATISTICS")
```

Common optimization techniques:

1. **Broadcast hints for small tables**:
```python
# Broadcast the smaller table in a join
spark.sql("""
SELECT /*+ BROADCAST(customers) */ 
  customers.name, 
  SUM(sales.amount) as total
FROM sales
JOIN customers ON sales.customer_id = customers.id
GROUP BY customers.name
""")
```

2. **Repartitioning for better parallelism**:
```python
# Repartition before a heavy operation
df = df.repartition(200, "customer_id").cache()
```

3. **Caching frequently used DataFrames**:
```python
# Cache a DataFrame that will be used multiple times
frequent_df = spark.table("high_value_customers").cache()
frequent_df.count()  # Materialize the cache
```

#### Analyzing Performance with Spark UI

The Spark UI provides detailed insights into job execution:

1. **Jobs tab**: Overview of Spark jobs and their stages
2. **Stages tab**: Detailed view of task distribution and skew
3. **Storage tab**: Information about cached data
4. **SQL tab**: SQL query execution details
5. **Executors tab**: Executor resource utilization

Key metrics to monitor:
- **Task skew**: Identify tasks taking much longer than others
- **Spill**: Data spilled to disk indicates memory pressure
- **Shuffle read/write**: Large shuffles can be performance bottlenecks

#### Hands-on Exercise: Performance Tuning

1. Analyze a slow-running query using the Spark UI
2. Identify bottlenecks (skew, inefficient joins, etc.)
3. Apply optimization techniques (broadcast joins, partitioning)
4. Measure performance improvement
5. Document best practices for your specific workload patterns

### Delta Lake Optimization Strategies

#### Physical Layout Optimization

Optimizing how data is stored on disk can dramatically improve query performance:

```sql
-- Z-ordering for multi-dimensional filtering
OPTIMIZE sales_data
ZORDER BY (date, region, product_category);

-- Partitioning for high-cardinality filtering
CREATE TABLE sales_partitioned
PARTITIONED BY (date)
AS SELECT * FROM sales_data;

-- Data skipping statistics
ANALYZE TABLE sales_partitioned COMPUTE STATISTICS;
```

#### Liquid Clustering (Preview)

Liquid Clustering provides automatic data organization advantages:

```sql
-- Create a table with Liquid Clustering
CREATE TABLE sales_data_clustered (
  transaction_id STRING,
  customer_id STRING,
  product_id STRING,
  store_id STRING,
  transaction_date DATE,
  amount DOUBLE
)
CLUSTER BY (transaction_date, store_id);

-- Convert existing table to use Liquid Clustering
ALTER TABLE sales_data
CLUSTER BY (transaction_date, store_id);
```

#### Optimizing for Specific Query Patterns

```sql
-- Create and maintain materialized views for common query patterns
CREATE MATERIALIZED VIEW daily_sales_by_region
AS SELECT 
  transaction_date,
  region,
  SUM(amount) as daily_total
FROM sales s
JOIN stores st ON s.store_id = st.id
GROUP BY transaction_date, region;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW daily_sales_by_region;
```

#### Vacuum and Retention Policies

Managing historical versions and cleaning up old files:

```sql
-- View retention period
SHOW TBLPROPERTIES sales_data LIKE 'delta.logRetentionDuration';

-- Change retention period
ALTER TABLE sales_data 
SET TBLPROPERTIES ('delta.logRetentionDuration' = '30 days');

-- Vacuum old files (dry run)
VACUUM sales_data DRY RUN;

-- Vacuum old files (actual)
VACUUM sales_data RETAIN 168 HOURS;
```

#### Hands-on Exercise: Delta Lake Optimization

1. Analyze query patterns on a dataset
2. Implement appropriate physical optimization strategies
3. Configure and test Liquid Clustering
4. Create materialized views for common query patterns
5. Set up appropriate data retention policies

## 2. Advanced Data Pipeline Design Patterns

### Incremental Data Processing Patterns

#### Slowly Changing Dimensions (SCD)

Implementing SCD Type 2 with Delta Lake:

```python
# SCD Type 2 implementation
from pyspark.sql.functions import current_timestamp, lit

# 1. Identify changed records
customers_current = spark.table("customers")
customers_new = spark.table("customers_updates")

# Join to find changes
matched_records = customers_current.alias("current").join(
    customers_new.alias("new"),
    customers_current.customer_id == customers_new.customer_id,
    "inner"
).where("""
    current.email != new.email OR
    current.address != new.address OR
    current.phone != new.phone
""")

# 2. Expire current records
to_expire = matched_records.select(
    "current.customer_id",
    "current.name",
    "current.email",
    "current.address",
    "current.phone",
    "current.valid_from",
    current_timestamp().alias("valid_to"),
    lit(False).alias("is_current")
)

# 3. Insert new records
to_insert = matched_records.select(
    "new.customer_id",
    "new.name",
    "new.email",
    "new.address",
    "new.phone",
    current_timestamp().alias("valid_from"),
    lit(None).alias("valid_to"),
    lit(True).alias("is_current")
)

# 4. Insert records for new customers
new_customers = customers_new.join(
    customers_current,
    customers_new.customer_id == customers_current.customer_id,
    "left_anti"
).select(
    "customer_id",
    "name",
    "email",
    "address",
    "phone",
    current_timestamp().alias("valid_from"),
    lit(None).alias("valid_to"),
    lit(True).alias("is_current")
)

# 5. Update the table with MERGE
from delta.tables import DeltaTable

customers_table = DeltaTable.forName(spark, "customers")

# Expire current records
customers_table.alias("customers").merge(
    to_expire.alias("updates"),
    "customers.customer_id = updates.customer_id AND customers.is_current = true"
).whenMatched().updateAll().execute()

# Insert new versions and new customers
customers_table.alias("customers").merge(
    to_insert.union(new_customers).alias("updates"),
    "customers.customer_id = updates.customer_id AND customers.valid_from = updates.valid_from"
).whenNotMatched().insertAll().execute()
```

#### Change Data Capture (CDC)

Processing CDC records with Delta Live Tables:

```python
import dlt
from pyspark.sql.functions import col

@dlt.table(
  name="bronze_cdc_records",
  comment="Raw CDC records from source system"
)
def bronze_cdc_records():
  return (
    spark.readStream.format("cloudFiles")
      .option("cloudFiles.format", "json")
      .load("/mnt/landing/cdc/")
  )

@dlt.table(
  name="silver_customers",
  comment="Latest customer data processed from CDC feeds"
)
def silver_customers():
  cdc_records = dlt.read("bronze_cdc_records")
  
  # Process inserts
  inserts = cdc_records.filter(col("operation") == "INSERT").select(
    col("after.*"),
    col("timestamp").alias("last_updated")
  )
  
  # Process updates
  updates = cdc_records.filter(col("operation") == "UPDATE").select(
    col("after.*"),
    col("timestamp").alias("last_updated")
  )
  
  # Process deletes
  deletes = cdc_records.filter(col("operation") == "DELETE").select(
    col("before.customer_id"),
    col("timestamp").alias("deleted_at")
  )
  
  # Apply changes to target table
  return (
    dlt.apply_changes(
      target = "silver_customers",
      source = inserts.union(updates),
      keys = ["customer_id"],
      sequence_by = col("last_updated"),
      apply_as_deletes = deletes,
      except_column_list = ["deleted_at"]
    )
  )
```

#### Incremental Aggregation

Computing aggregations incrementally with Structured Streaming:

```python
from pyspark.sql import functions as F
from pyspark.sql.window import Window

# Stream of event data
events = spark.readStream.format("delta").table("events")

# Define watermark for late data
events_with_watermark = events.withWatermark("event_time", "1 hour")

# Compute sliding window aggregations
windowed_counts = events_with_watermark.groupBy(
    F.window("event_time", "1 hour", "15 minutes"),
    "event_type"
).count()

# Write results to Delta table
query = windowed_counts.writeStream \
    .format("delta") \
    .outputMode("complete") \
    .option("checkpointLocation", "/mnt/checkpoints/windowed_counts") \
    .table("hourly_event_counts")
```

#### Hands-on Exercise: Implementing Advanced Processing Patterns

1. Design and implement an SCD Type 2 pipeline
2. Build a CDC processing pipeline using Delta Live Tables
3. Implement incremental aggregations with watermarking
4. Test handling of late-arriving data
5. Measure performance compared to full reprocessing

### Resilient Pipeline Design

#### Error Handling and Recovery

Implementing robust error handling in pipelines:

```python
# Error handling with exception capture
def process_with_error_handling(batch_df, batch_id):
    try:
        # Process the batch
        processed_df = transform_data(batch_df)
        
        # Write successfully processed records
        processed_df.write.format("delta").mode("append").saveAsTable("processed_data")
        
        # Track success
        log_success(batch_id, processed_df.count())
        
    except Exception as e:
        # Log the error
        log_error(batch_id, str(e))
        
        # Write failed records to error table
        batch_df.withColumn("error", F.lit(str(e))) \
            .withColumn("error_time", F.current_timestamp()) \
            .write.format("delta").mode("append").saveAsTable("failed_records")
        
        # Optionally raise to fail the job
        # raise e

# Use in a streaming context
query = df.writeStream \
    .foreachBatch(process_with_error_handling) \
    .option("checkpointLocation", "/mnt/checkpoints/process") \
    .start()
```

#### Data Quality Monitoring

Implementing data quality checks with expectations:

```python
import dlt
from pyspark.sql import functions as F

# Define data quality rules
@dlt.table(
  name="silver_transactions"
)
@dlt.expect_all({
  "valid_amount": "amount > 0",
  "valid_transaction_id": "transaction_id IS NOT NULL",
  "valid_date": "transaction_date <= current_date()"
})
@dlt.expect_or_drop(
  "complete_record", "customer_id IS NOT NULL AND store_id IS NOT NULL"
)
def silver_transactions():
  return (
    dlt.read("bronze_transactions")
      .withColumn("amount", F.col("amount").cast("double"))
      .withColumn("transaction_date", F.to_date(F.col("transaction_date")))
  )

# Track data quality metrics
@dlt.table(
  name="data_quality_metrics"
)
def data_quality_metrics():
  metrics = dlt.read_metric_history("silver_transactions.valid_amount,silver_transactions.valid_transaction_id,silver_transactions.valid_date,silver_transactions.complete_record")
  
  return (
    metrics
      .groupBy("flow_progress.flow_name", "flow_progress.flow_id", "flow_progress.run_id", "metric_name")
      .agg(
        F.min("metric_value.pipeline_progress.data_quality.dropped_records").alias("dropped_records"),
        F.min("metric_value.pipeline_progress.data_quality.expectations.failed_records").alias("failed_records"),
        F.min("metric_value.pipeline_progress.data_quality.expectations.passed_records").alias("passed_records")
      )
  )
```

#### Circuit Breakers and Failover

Implementing circuit breakers to prevent cascading failures:

```python
# Simple circuit breaker implementation
class CircuitBreaker:
    def __init__(self, failure_threshold=3, reset_timeout=300):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.last_failure_time = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    def is_allowed(self):
        current_time = time.time()
        
        # Check if circuit needs to be reset
        if self.state == "OPEN" and current_time - self.last_failure_time > self.reset_timeout:
            self.state = "HALF_OPEN"
            print("Circuit half-open, allowing test request")
        
        return self.state != "OPEN"
    
    def record_success(self):
        if self.state == "HALF_OPEN":
            self.state = "CLOSED"
            self.failure_count = 0
            print("Circuit closed")
    
    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            print(f"Circuit open, blocking requests for {self.reset_timeout} seconds")

# Usage in a data pipeline
circuit_breaker = CircuitBreaker(failure_threshold=3, reset_timeout=300)

def process_batch_with_circuit_breaker(batch_df, batch_id):
    if not circuit_breaker.is_allowed():
        print("Circuit breaker open, skipping batch")
        return
    
    try:
        # Process the batch
        result_df = process_data(batch_df)
        
        # Record success
        circuit_breaker.record_success()
        
        # Continue with normal processing
        result_df.write.format("delta").mode("append").saveAsTable("processed_data")
    except Exception as e:
        # Record failure
        circuit_breaker.record_failure()
        
        # Handle error
        print(f"Error processing batch {batch_id}: {str(e)}")
        
        # Write to error table
        batch_df.withColumn("error", F.lit(str(e))) \
            .write.format("delta").mode("append").saveAsTable("error_data")
```

#### Idempotent Operations

Ensuring operations can be safely retried:

```python
# Idempotent write with deduplication
def idempotent_write(df, table_name, unique_key_columns):
    """
    Write data to a table in an idempotent way by deduplicating based on key columns.
    """
    # Generate a batch ID for this operation
    batch_id = str(uuid.uuid4())
    
    # Add batch metadata
    df_with_metadata = df.withColumn("_batch_id", F.lit(batch_id)) \
                         .withColumn("_inserted_at", F.current_timestamp())
    
    # Write to a staging table
    staging_table = f"{table_name}_staging_{batch_id.replace('-', '_')}"
    df_with_metadata.write.format("delta").saveAsTable(staging_table)
    
    # Perform idempotent merge into target
    key_condition = " AND ".join([f"target.{col} = source.{col}" for col in unique_key_columns])
    
    spark.sql(f"""
    MERGE INTO {table_name} target
    USING {staging_table} source
    ON {key_condition}
    WHEN MATCHED THEN
        UPDATE SET *
    WHEN NOT MATCHED THEN
        INSERT *
    """)
    
    # Clean up staging table
    spark.sql(f"DROP TABLE {staging_table}")
```

#### Hands-on Exercise: Building Resilient Pipelines

1. Implement comprehensive error handling in a pipeline
2. Add data quality monitoring with expectations
3. Set up circuit breakers for external dependencies
4. Create idempotent write operations
5. Test recovery from various failure scenarios

## 3. CI/CD for Data Engineering on Databricks

### Version Control and Development Workflows

#### Git Integration with Databricks Repos

Setting up and using Git repositories in Databricks:

1. **Connect a repository**:
   - In the Databricks UI: Repos > Add Repo
   - Provide Git URL and credentials
   - Clone the repository into Databricks

2. **Working with branches**:
   - Create new branches for features
   - Submit pull requests for review
   - Merge changes to main branch

3. **Development workflow**:
   - Create a feature branch
   - Develop and test in notebooks
   - Commit changes and push to remote
   - Create PR for review
   - Merge to main branch
   - Deploy to production

#### Databricks Asset Bundles (DABs)

DABs provide a way to package and deploy Databricks assets:

```bash
# Install Databricks CLI
pip install databricks-cli

# Initialize DAB configuration
databricks bundle init

# Bundle structure
my_project/
├── .databricks/
│   └── bundle.yml
├── resources/
│   ├── notebooks/
│   │   └── etl_pipeline.py
│   ├── jobs/
│   │   └── daily_etl.yml
│   └── pipelines/
│       └── dlt_pipeline.yml
├── tests/
│   └── test_etl_pipeline.py
└── README.md

# Deploy bundle
databricks bundle deploy
```

Example `bundle.yml`:

```yaml
bundle:
  name: retail_analytics

workspace:
  host: ${DATABRICKS_HOST}
  token: ${DATABRICKS_TOKEN}

resources:
  pipelines:
    retail_analytics_pipeline:
      path: resources/pipelines/dlt_pipeline.yml
      target: dev
      continuous: false
      development: true
      photon: true
      channels:
        - current
      configuration:
        - key: source_path
          value: /mnt/landing/retail
  
  jobs:
    daily_etl:
      path: resources/jobs/daily_etl.yml
      schedule:
        quartz_cron_expression: "0 0 2 * * ?"
        timezone_id: "UTC"
      email_notifications:
        on_failure:
          - team@example.com
      tags:
        environment: dev
```

### Testing Strategies for Data Pipelines

#### Unit Testing

Writing unit tests for transformation logic:

```python
# tests/test_transformations.py
import unittest
from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType
from src.transformations import clean_customer_data

class TestTransformations(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        cls.spark = SparkSession.builder \
            .appName("UnitTests") \
            .getOrCreate()
    
    def test_clean_customer_data(self):
        # Define test schema
        schema = StructType([
            StructField("customer_id", StringType(), True),
            StructField("name", StringType(), True),
            StructField("email", StringType(), True),
            StructField("age", IntegerType(), True)
        ])
        
        # Create test data
        test_data = [
            ("C001", "john smith", "john.smith@example.com", 35),
            ("C002", "JANE DOE", "jane.doe@example.com", -5),
            ("C003", "  Bob Jones  ", "invalid-email", 150),
            ("C004", "Alice Brown", None, 25)
        ]
        
        test_df = self.spark.createDataFrame(test_data, schema)
        
        # Apply transformation
        result_df = clean_customer_data(test_df)
        
        # Convert to list for assertions
        results = result_df.collect()
        
        # Verify results
        self.assertEqual(len(results), 4)
        
        # Check case normalization
        self.assertEqual(results[0].name, "John Smith")
        self.assertEqual(results[1].name, "Jane Doe")
        
        # Check age constraints
        self.assertEqual(results[1].age, 0)  # Should be clamped to minimum
        self.assertEqual(results[2].age, 120)  # Should be clamped to maximum
        
        # Check email validation
        self.assertEqual(results[2].valid_email, False)
        self.assertEqual(results[0].valid_email, True)
        self.assertEqual(results[3].valid_email, False)  # Null email
        
        # Check string trimming
        self.assertEqual(results[2].name, "Bob Jones")  # Spaces trimmed
    
    @classmethod
    def tearDownClass(cls):
        cls.spark.stop()

if __name__ == "__main__":
    unittest.main()
```

#### Integration Testing

Testing pipeline components together:

```python
# tests/test_pipeline_integration.py
import unittest
from pyspark.sql import SparkSession
from delta.tables import DeltaTable
import os

class TestPipelineIntegration(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        cls.spark = SparkSession.builder \
            .appName("IntegrationTests") \
            .master("local[2]") \
            .config("spark.sql.warehouse.dir", "/tmp/warehouse") \
            .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension") \
            .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog") \
            .getOrCreate()
        
        # Set up test data
        cls._create_test_data()
    
    @classmethod
    def _create_test_data(cls):
        # Create bronze test data
        cls.spark.sql("CREATE DATABASE IF NOT EXISTS test_db")
        
        # Create test customer data
        customer_df = cls.spark.createDataFrame([
            ("C001", "John Smith", "john@example.com", 35),
            ("C002", "Jane Doe", "jane@example.com", 42)
        ], ["customer_id", "name", "email", "age"])
        
        customer_df.write.format("delta").mode("overwrite").saveAsTable("test_db.customers_bronze")
        
        # Create test transaction data
        transaction_df = cls.spark.createDataFrame([
            ("T001", "C001", "2023-01-15", 100.50),
            ("T002", "C002", "2023-01-16", 200.75),
            ("T003", "C001", "2023-01-17", 50.25)
        ], ["transaction_id", "customer_id", "transaction_date", "amount"])
        
        transaction_df.write.format("delta").mode("overwrite").saveAsTable("test_db.transactions_bronze")
    
    def test_end_to_end_pipeline(self):
        # Import the pipeline functions
        import sys
        sys.path.append("../src")
        from pipeline import process_customers, process_transactions, create_customer_summary
        
        # Run the pipeline components
        process_customers("test_db.customers_bronze", "test_db.customers_silver")
        process_transactions("test_db.transactions_bronze", "test_db.transactions_silver")
        create_customer_summary("test_db.customers_silver", "test_db.transactions_silver", "test_db.customer_summary")
        
        # Verify the results
        customer_summary = self.spark.table("test_db.customer_summary")
        results = customer_summary.collect()
        
        # Check results match expectations
        self.assertEqual(len(results), 2)
        
        # Find C001 record
        c001_record = next(r for r in results if r.customer_id == "C001")
        self.assertEqual(c001_record.transaction_count, 2)
        self.assertEqual(c001_record.total_spent, 150.75)
        
        # Find C002 record
        c002_record = next(r for r in results if r.customer_id == "C002")
        self.assertEqual(c002_record.transaction_count, 1)
        self.assertEqual(c002_record.total_spent, 200.75)
    
    @classmethod
    def tearDownClass(cls):
        # Clean up test database
        cls.spark.sql("DROP DATABASE IF EXISTS test_db CASCADE")
        cls.spark.stop()

if __name__ == "__main__":
    unittest.main()
```

#### Data Quality Testing

Testing data quality requirements:

```python
# tests/test_data_quality.py
import unittest
from pyspark.sql import SparkSession
from pyspark.sql.functions import col

class TestDataQuality(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        cls.spark = SparkSession.builder \
            .appName("DataQualityTests") \
            .getOrCreate()
    
    def test_customer_data_quality(self):
        # Read the customer data
        customers = self.spark.table("customers_silver")
        
        # Test for nulls in required fields
        null_customer_ids = customers.filter(col("customer_id").isNull()).count()
        self.assertEqual(null_customer_ids, 0, "There should be no null customer IDs")
        
        # Test email format
        invalid_emails = customers.filter(
            ~col("email").rlike("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")
        ).count()
        self.assertEqual(invalid_emails, 0, "All emails should be in valid format")
        
        # Test age ranges
        invalid_ages = customers.filter(
            (col("age") < 0) | (col("age") > 120)
        ).count()
        self.assertEqual(invalid_ages, 0, "All ages should be between 0 and 120")
        
        # Test uniqueness constraints
        total_count = customers.count()
        distinct_count = customers.select("customer_id").distinct().count()
        self.assertEqual(total_count, distinct_count, "Customer IDs should be unique")
    
    def test_transaction_data_quality(self):
        # Read the transaction data
        transactions = self.spark.table("transactions_silver")
        
        # Test for nulls in required fields
        null_transaction_ids = transactions.filter(col("transaction_id").isNull()).count()
        self.assertEqual(null_transaction_ids, 0, "There should be no null transaction IDs")
        
        # Test amount ranges
        negative_amounts = transactions.filter(col("amount") < 0).count()
        self.assertEqual(negative_amounts, 0, "All transaction amounts should be positive")
        
        # Test date ranges
        future_dates = transactions.filter(
            col("transaction_date") > current_date()
        ).count()
        self.assertEqual(future_dates, 0, "No transaction dates should be in the future")
        
        # Test referential integrity
        transactions_table = self.spark.table("transactions_silver")
        customers_table = self.spark.table("customers_silver")
        
        orphaned_transactions = transactions_table.join(
            customers_table,
            transactions_table.customer_id == customers_table.customer_id,
            "left_anti"
        ).count()
        
        self.assertEqual(orphaned_transactions, 0, "All transactions should have a matching customer")
    
    @classmethod
    def tearDownClass(cls):
        cls.spark.stop()

if __name__ == "__main__":
    unittest.main()
```

#### Hands-on Exercise: Testing Data Pipelines

1. Write unit tests for key transformation functions
2. Implement integration tests for a complete pipeline
3. Create data quality validation tests
4. Configure automated test execution
5. Review test results and improve test coverage

### Automating Deployments

#### CI/CD Pipeline Setup

Setting up a CI/CD pipeline with GitHub Actions:

```yaml
# .github/workflows/deploy-databricks.yml
name: Deploy to Databricks

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install pyspark==3.3.0 delta-spark==2.3.0 pytest pytest-cov
        if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
    - name: Test with pytest
      run: |
        pytest tests/ --cov=src/

  lint:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install flake8 black isort
    - name: Lint with flake8
      run: |
        flake8 src/ tests/ --count --select=E9,F63,F7,F82 --show-source --statistics
    - name: Check formatting with black
      run: |
        black --check src/ tests/
    - name: Check imports with isort
      run: |
        isort --check-only --profile black src/ tests/

  deploy:
    needs: [test, lint]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    - name: Install Databricks CLI
      run: |
        pip install databricks-cli
    - name: Deploy to Dev
      env:
        DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
        DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}
      run: |
        databricks bundle deploy --target dev
    - name: Run Smoke Tests
      env:
        DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
        DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}
      run: |
        python smoketests/run_tests.py
    - name: Deploy to Prod
      if: success()
      env:
        DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST_PROD }}
        DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN_PROD }}
      run: |
        databricks bundle deploy --target prod
```

#### Multi-Environment Configuration

Managing configurations for different environments:

```yaml
# .databricks/bundle.yml
bundle:
  name: retail_analytics

targets:
  dev:
    workspace:
      host: ${DATABRICKS_HOST}
      token: ${DATABRICKS_TOKEN}
    variables:
      environment: dev
      data_path: /mnt/dev/retail
      notification_email: dev-team@example.com
      auto_optimize: true
      refresh_schedule: "0 */2 * * *"  # Every 2 hours
      cluster_workers_min: 2
      cluster_workers_max: 8
      
  qa:
    workspace:
      host: ${DATABRICKS_HOST_QA}
      token: ${DATABRICKS_TOKEN_QA}
    variables:
      environment: qa
      data_path: /mnt/qa/retail
      notification_email: qa-team@example.com
      auto_optimize: true
      refresh_schedule: "0 */4 * * *"  # Every 4 hours
      cluster_workers_min: 2
      cluster_workers_max: 4
      
  prod:
    workspace:
      host: ${DATABRICKS_HOST_PROD}
      token: ${DATABRICKS_TOKEN_PROD}
    variables:
      environment: prod
      data_path: /mnt/prod/retail
      notification_email: alerts@example.com
      auto_optimize: true
      refresh_schedule: "0 */1 * * *"  # Every hour
      cluster_workers_min: 4
      cluster_workers_max: 16

resources:
  pipelines:
    retail_pipeline:
      path: resources/pipelines/retail_pipeline.yml
      target: ${bundle.target}
      configuration:
        - key: data_path
          value: ${variables.data_path}
        - key: environment
          value: ${variables.environment}
          
  jobs:
    retail_reports:
      path: resources/jobs/retail_reports.yml
      schedule:
        quartz_cron_expression: ${variables.refresh_schedule}
        timezone_id: "UTC"
      email_notifications:
        on_failure:
          - ${variables.notification_email}
      tags:
        environment: ${variables.environment}
```

#### Infrastructure as Code

Defining infrastructure with Terraform:

```hcl
# main.tf
provider "databricks" {
  host  = var.databricks_host
  token = var.databricks_token
}

resource "databricks_cluster" "processing_cluster" {
  cluster_name            = "${var.environment}-processing-cluster"
  spark_version           = "11.3.x-scala2.12"
  node_type_id            = var.node_type_id
  autotermination_minutes = 20
  
  autoscale {
    min_workers = var.cluster_workers_min
    max_workers = var.cluster_workers_max
  }
  
  spark_conf = {
    "spark.databricks.delta.optimizeWrite.enabled" = "true"
    "spark.databricks.delta.autoCompact.enabled"   = "true"
    "spark.sql.adaptive.enabled"                   = "true"
  }
  
  custom_tags = {
    "Environment" = var.environment
    "Project"     = "RetailAnalytics"
  }
}

resource "databricks_job" "etl_job" {
  name = "${var.environment}-retail-etl"
  
  job_cluster {
    job_cluster_key = "processing_cluster"
    
    new_cluster {
      spark_version           = "11.3.x-scala2.12"
      node_type_id            = var.node_type_id
      autoscale {
        min_workers = var.cluster_workers_min
        max_workers = var.cluster_workers_max
      }
    }
  }
  
  task {
    task_key = "ingest"
    
    notebook_task {
      notebook_path = "/Repos/retail_analytics/notebooks/ingest"
      base_parameters = {
        "environment" = var.environment
        "data_path"   = var.data_path
      }
    }
    
    job_cluster_key = "processing_cluster"
  }
  
  task {
    task_key = "transform"
    
    notebook_task {
      notebook_path = "/Repos/retail_analytics/notebooks/transform"
      base_parameters = {
        "environment" = var.environment
        "data_path"   = var.data_path
      }
    }
    
    job_cluster_key = "processing_cluster"
    
    depends_on {
      task_key = "ingest"
    }
  }
  
  task {
    task_key = "aggregate"
    
    notebook_task {
      notebook_path = "/Repos/retail_analytics/notebooks/aggregate"
      base_parameters = {
        "environment" = var.environment
        "data_path"   = var.data_path
      }
    }
    
    job_cluster_key = "processing_cluster"
    
    depends_on {
      task_key = "transform"
    }
  }
  
  schedule {
    quartz_cron_expression = var.schedule_cron
    timezone_id = "UTC"
  }
  
  email_notifications {
    on_success = []
    on_failure = [var.notification_email]
  }
}

# variables.tf
variable "databricks_host" {
  description = "Databricks workspace URL"
  type        = string
}

variable "databricks_token" {
  description = "Databricks access token"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Deployment environment (dev, qa, prod)"
  type        = string
}

variable "node_type_id" {
  description = "Databricks node type"
  type        = string
  default     = "Standard_DS3_v2"
}

variable "cluster_workers_min" {
  description = "Minimum number of workers"
  type        = number
}

variable "cluster_workers_max" {
  description = "Maximum number of workers"
  type        = number
}

variable "data_path" {
  description = "Path to data in storage"
  type        = string
}

variable "schedule_cron" {
  description = "Cron schedule expression"
  type        = string
}

variable "notification_email" {
  description = "Email for notifications"
  type        = string
}
```

#### Hands-on Exercise: Setting up Automated Deployments

1. Configure a GitHub Actions workflow for CI/CD
2. Create environment-specific configurations
3. Implement infrastructure as code with Terraform
4. Set up automated testing and deployment
5. Practice the complete deployment lifecycle

## 4. Monitoring and Observability

### Performance Monitoring

#### Tracking Job and Query Performance

Tools and techniques for monitoring performance:

1. **Databricks Job UI**:
   - Job execution history
   - Task-level runtime metrics
   - Resource utilization graphs

2. **Spark UI**:
   - Event timeline
   - SQL query execution details
   - Storage tab for caching efficiency

3. **Custom monitoring using Ganglia metrics**:

```python
# Get Ganglia metrics
def get_cluster_metrics(cluster_id):
    response = requests.get(
        f"https://<databricks-instance>/api/2.0/clusters/get",
        headers={"Authorization": f"Bearer {token}"},
        params={"cluster_id": cluster_id}
    )
    
    cluster_info = response.json()
    spark_ui_url = cluster_info.get("spark_context_id")
    
    if spark_ui_url:
        metrics_url = f"https://<databricks-instance>/driver-proxy-api/o/0/{cluster_id}/{spark_ui_url}/metrics/json/"
        metrics_response = requests.get(
            metrics_url,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        return metrics_response.json()
    
    return None

# Track metrics over time
def monitor_cluster_performance(cluster_id, interval_seconds=60, duration_minutes=60):
    metrics_history = []
    
    num_samples = int((duration_minutes * 60) / interval_seconds)
    
    for i in range(num_samples):
        metrics = get_cluster_metrics(cluster_id)
        if metrics:
            timestamp = datetime.now().isoformat()
            metrics_history.append({
                "timestamp": timestamp,
                "metrics": metrics
            })
            
            # Extract key metrics
            cpu_usage = metrics.get("gauges", {}).get("system.cpu.usage", {}).get("value")
            memory_used = metrics.get("gauges", {}).get("system.memory.used", {}).get("value")
            disk_io = metrics.get("gauges", {}).get("system.disk.io", {}).get("value")
            
            print(f"[{timestamp}] CPU: {cpu_usage}%, Memory: {memory_used} bytes, Disk IO: {disk_io} bytes/sec")
        
        time.sleep(interval_seconds)
    
    return metrics_history
```

#### Performance Dashboard

Creating a performance monitoring dashboard:

```sql
-- Create a job performance tracking table
CREATE TABLE job_performance_metrics (
  job_id BIGINT,
  run_id BIGINT,
  task_key STRING,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_seconds BIGINT,
  status STRING,
  cluster_id STRING,
  num_workers INT,
  input_records BIGINT,
  output_records BIGINT,
  shuffle_read_bytes BIGINT,
  shuffle_write_bytes BIGINT,
  executor_cpu_time_ms BIGINT,
  executor_peak_memory_usage BIGINT
);

-- Query for dashboard
SELECT 
  job_id,
  task_key,
  AVG(duration_seconds) as avg_duration,
  PERCENTILE(duration_seconds, 0.5) as median_duration,
  PERCENTILE(duration_seconds, 0.95) as p95_duration,
  MAX(duration_seconds) as max_duration,
  MIN(duration_seconds) as min_duration,
  COUNT(*) as execution_count,
  COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) / COUNT(*) * 100 as success_rate
FROM job_performance_metrics
WHERE start_time > current_date() - INTERVAL 30 DAYS
GROUP BY job_id, task_key
ORDER BY avg_duration DESC;
```

### Data Quality Monitoring

#### Building Data Quality Dashboards

Implementing a data quality monitoring system:

```python
# Data quality metrics tracking
from pyspark.sql import functions as F
from pyspark.sql.window import Window

def calculate_data_quality_metrics(table_name, primary_key=None):
    """
    Calculate various data quality metrics for a table
    """
    df = spark.table(table_name)
    column_metrics = []
    
    # Get schema information
    schema = df.schema
    
    # Record count
    row_count = df.count()
    
    # Column-level metrics
    for field in schema.fields:
        col_name = field.name
        data_type = str(field.dataType)
        
        # Basic metrics for all columns
        null_count = df.filter(F.col(col_name).isNull()).count()
        null_percentage = (null_count / row_count) * 100 if row_count > 0 else 0
        
        # Type-specific metrics
        if "string" in data_type.lower():
            # String-specific metrics
            empty_count = df.filter(F.col(col_name) == "").count()
            min_length = df.select(F.min(F.length(F.col(col_name)))).collect()[0][0]
            max_length = df.select(F.max(F.length(F.col(col_name)))).collect()[0][0]
            avg_length = df.select(F.avg(F.length(F.col(col_name)))).collect()[0][0]
            
            col_metrics = {
                "column_name": col_name,
                "data_type": data_type,
                "null_count": null_count,
                "null_percentage": null_percentage,
                "empty_count": empty_count,
                "min_length": min_length,
                "max_length": max_length,
                "avg_length": avg_length
            }
        elif any(x in data_type.lower() for x in ["int", "double", "float", "decimal"]):
            # Numeric-specific metrics
            min_value = df.select(F.min(F.col(col_name))).collect()[0][0]
            max_value = df.select(F.max(F.col(col_name))).collect()[0][0]
            avg_value = df.select(F.avg(F.col(col_name))).collect()[0][0]
            std_dev = df.select(F.stddev(F.col(col_name))).collect()[0][0]
            
            col_metrics = {
                "column_name": col_name,
                "data_type": data_type,
                "null_count": null_count,
                "null_percentage": null_percentage,
                "min_value": min_value,
                "max_value": max_value,
                "avg_value": avg_value,
                "std_dev": std_dev
            }
        elif "date" in data_type.lower() or "timestamp" in data_type.lower():
            # Date-specific metrics
            min_date = df.select(F.min(F.col(col_name))).collect()[0][0]
            max_date = df.select(F.max(F.col(col_name))).collect()[0][0]
            
            col_metrics = {
                "column_name": col_name,
                "data_type": data_type,
                "null_count": null_count,
                "null_percentage": null_percentage,
                "min_date": min_date,
                "max_date": max_date
            }
        else:
            # Default metrics for other types
            col_metrics = {
                "column_name": col_name,
                "data_type": data_type,
                "null_count": null_count,
                "null_percentage": null_percentage
            }
        
        column_metrics.append(col_metrics)
    
    # Duplicate checks if primary key is provided
    unique_count = None
    duplicate_count = None
    
    if primary_key:
        if isinstance(primary_key, list):
            # Composite key
            unique_count = df.select(*primary_key).distinct().count()
        else:
            # Single column key
            unique_count = df.select(primary_key).distinct().count()
        
        duplicate_count = row_count - unique_count
    
    # Create metrics DataFrame
    metrics_df = spark.createDataFrame(column_metrics)
    
    # Add table-level metrics
    table_metrics = {
        "table_name": table_name,
        "row_count": row_count,
        "column_count": len(schema.fields),
        "primary_key": primary_key,
        "unique_count": unique_count,
        "duplicate_count": duplicate_count,
        "capture_time": F.current_timestamp()
    }
    
    return metrics_df, table_metrics
```

#### Anomaly Detection for Data Pipelines

Implementing automated anomaly detection:

```python
# Z-score based anomaly detection for metrics
def detect_anomalies(metrics_history_df, metric_column, z_threshold=3.0):
    """
    Detect anomalies in a metric using Z-score
    """
    # Calculate statistics
    mean = metrics_history_df.select(F.avg(metric_column)).collect()[0][0]
    stddev = metrics_history_df.select(F.stddev(metric_column)).collect()[0][0]
    
    # Handle zero standard deviation
    if stddev == 0 or stddev is None:
        return metrics_history_df.withColumn(
            "is_anomaly", 
            F.lit(False)
        ).withColumn(
            "z_score",
            F.lit(0)
        )
    
    # Calculate Z-score
    anomalies_df = metrics_history_df.withColumn(
        "z_score",
        F.abs((F.col(metric_column) - mean) / stddev)
    ).withColumn(
        "is_anomaly",
        F.col("z_score") > z_threshold
    )
    
    return anomalies_df

# Moving average based anomaly detection
def detect_trend_anomalies(metrics_history_df, metric_column, date_column, window_size=7, threshold_pct=20):
    """
    Detect anomalies based on deviation from moving average
    """
    # Define window spec for moving average
    window_spec = Window.orderBy(date_column).rowsBetween(-window_size, -1)
    
    # Calculate moving average
    trend_df = metrics_history_df.withColumn(
        "moving_avg", 
        F.avg(metric_column).over(window_spec)
    )
    
    # Calculate percent deviation from moving average
    trend_df = trend_df.withColumn(
        "pct_deviation",
        F.when(
            F.col("moving_avg").isNotNull() & (F.col("moving_avg") != 0),
            F.abs((F.col(metric_column) - F.col("moving_avg")) / F.col("moving_avg") * 100)
        ).otherwise(0)
    )
    
    # Flag anomalies
    trend_df = trend_df.withColumn(
        "is_trend_anomaly",
        (F.col("pct_deviation") > threshold_pct) & F.col("moving_avg").isNotNull()
    )
    
    return trend_df
```

### Alerting and Notification Systems

#### Setting Up Alerts

Configuring alerts for various conditions:

```python
# Define alert thresholds
alert_config = {
    "job_failure": {
        "description": "Job execution failed",
        "severity": "high",
        "notification_channels": ["email", "slack"]
    },
    "data_quality": {
        "null_percentage": {
            "threshold": 5.0,  # Alert if null percentage > 5%
            "description": "High null percentage detected",
            "severity": "medium",
            "notification_channels": ["email"]
        },
        "duplicate_percentage": {
            "threshold": 1.0,  # Alert if duplicate percentage > 1%
            "description": "Duplicates detected in primary key",
            "severity": "high",
            "notification_channels": ["email", "slack"]
        }
    },
    "performance": {
        "job_duration": {
            "threshold": 7200,  # Alert if job runs longer than 2 hours
            "description": "Job execution time exceeded threshold",
            "severity": "low",
            "notification_channels": ["email"]
        },
        "cluster_memory": {
            "threshold": 90.0,  # Alert if memory usage > 90%
            "description": "High cluster memory usage",
            "severity": "medium",
            "notification_channels": ["email", "slack"]
        }
    }
}

# Send notification function
def send_notification(alert_type, alert_details, alert_config):
    """
    Send notification based on alert configuration
    """
    config = alert_config.get(alert_type)
    if not config:
        for category in alert_config:
            if isinstance(alert_config[category], dict) and alert_type in alert_config[category]:
                config = alert_config[category][alert_type]
                break
    
    if not config:
        print(f"No configuration found for alert type: {alert_type}")
        return
    
    severity = config.get("severity", "medium")
    description = config.get("description", "Alert triggered")
    channels = config.get("notification_channels", ["email"])
    
    message = f"""
    ALERT: {description}
    Severity: {severity.upper()}
    Details: {alert_details}
    Time: {datetime.now().isoformat()}
    """
    
    # Send to each configured channel
    for channel in channels:
        if channel == "email":
            send_email_alert(message, severity)
        elif channel == "slack":
            send_slack_alert(message, severity)
        # Add other channels as needed
```

#### Integration with Incident Management

Setting up integration with PagerDuty or similar services:

```python
# PagerDuty integration
import requests
import json

def create_pagerduty_incident(summary, details, severity="warning"):
    """
    Create an incident in PagerDuty
    """
    url = "https://api.pagerduty.com/incidents"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/vnd.pagerduty+json;version=2",
        "Authorization": f"Token token={PAGERDUTY_API_KEY}",
        "From": PAGERDUTY_EMAIL
    }
    
    payload = {
        "incident": {
            "type": "incident",
            "title": summary,
            "service": {
                "id": PAGERDUTY_SERVICE_ID,
                "type": "service_reference"
            },
            "urgency": "high" if severity in ["high", "critical"] else "low",
            "body": {
                "type": "incident_body",
                "details": json.dumps(details, indent=2)
            }
        }
    }
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code == 201:
        print(f"PagerDuty incident created: {response.json()['incident']['id']}")
        return response.json()['incident']['id']
    else:
        print(f"Failed to create PagerDuty incident: {response.status_code} - {response.text}")
        return None

# Example usage
def monitor_job_and_alert(job_id):
    """
    Monitor a job and create incident if it fails
    """
    job_status = get_job_status(job_id)
    
    if job_status == "FAILED":
        job_details = get_job_details(job_id)
        
        incident_details = {
            "job_id": job_id,
            "run_id": job_details.get("run_id"),
            "start_time": job_details.get("start_time"),
            "end_time": job_details.get("end_time"),
            "error_message": job_details.get("error_message"),
            "cluster_id": job_details.get("cluster_id")
        }
        
        create_pagerduty_incident(
            summary=f"Databricks Job {job_id} Failed",
            details=incident_details,
            severity="high"
        )
```

#### Hands-on Exercise: Implementing Monitoring and Alerting

1. Set up performance dashboards for pipeline monitoring
2. Implement data quality tracking with historical trends
3. Configure alerting for critical pipeline failures
4. Integrate with incident management systems
5. Set up automated remediation for common issues

## 5. Advanced Optimization Techniques

### Query and Pipeline Optimization Patterns

#### Cost-Based Optimization

Leveraging Spark's cost-based optimizer:

```sql
-- Collect and analyze table statistics
ANALYZE TABLE sales COMPUTE STATISTICS;
ANALYZE TABLE sales COMPUTE STATISTICS FOR COLUMNS customer_id, product_id, transaction_date;

-- Join reordering will be done automatically based on statistics
SELECT 
  c.name,
  p.product_name,
  SUM(s.quantity) as total_quantity,
  SUM(s.amount) as total_amount
FROM sales s
JOIN customers c ON s.customer_id = c.id
JOIN products p ON s.product_id = p.id
WHERE 
  s.transaction_date >= '2023-01-01'
  AND c.region = 'North America'
  AND p.category = 'Electronics'
GROUP BY 
  c.name,
  p.product_name;
```

#### Dynamic Partition Pruning

Optimizing queries for partitioned tables:

```sql
-- Create a partitioned table
CREATE TABLE sales_by_date
PARTITIONED BY (transaction_date)
AS SELECT * FROM sales;

-- Query that benefits from partition pruning
SELECT
  store_id,
  SUM(amount) as total_sales
FROM sales_by_date
WHERE 
  transaction_date BETWEEN '2023-01-01' AND '2023-01-31'
  AND amount > 100
GROUP BY store_id;

-- Controlling partition sizes
SET spark.sql.files.maxPartitionBytes = 134217728; -- 128 MB
SET spark.sql.shuffle.partitions = 200;

-- Adaptive query execution
SET spark.sql.adaptive.enabled = true;
SET spark.sql.adaptive.coalescePartitions.enabled = true;
SET spark.sql.adaptive.skewJoin.enabled = true;
```

#### Skew Handling

Dealing with data skew in joins and aggregations:

```python
from pyspark.sql import functions as F

# Identify skewed keys
def identify_skewed_keys(df, key_column, threshold_pct=10.0):
    """
    Identify keys that have skewed distribution
    """
    # Count frequency of each key
    key_counts = df.groupBy(key_column).count()
    
    # Calculate total count
    total_count = df.count()
    
    # Calculate percentage for each key
    key_distribution = key_counts.withColumn(
        "percentage", 
        (F.col("count") / total_count) * 100
    ).orderBy(F.desc("percentage"))
    
    # Identify keys above threshold
    skewed_keys = key_distribution.filter(F.col("percentage") > threshold_pct)
    
    return skewed_keys

# Handle skewed join
def handle_skewed_join(left_df, right_df, join_key, skewed_keys, num_splits=10):
    """
    Handle skewed join by splitting the processing of skewed keys
    """
    # Filter out skewed keys from normal processing
    skewed_key_values = [row[join_key] for row in skewed_keys.collect()]
    
    normal_left = left_df.filter(~F.col(join_key).isin(skewed_key_values))
    normal_right = right_df.filter(~F.col(join_key).isin(skewed_key_values))
    
    # Process normal keys with regular join
    normal_joined = normal_left.join(normal_right, join_key)
    
    # Process each skewed key separately with salting
    skewed_joined = None
    
    for skewed_key_value in skewed_key_values:
        left_skewed = left_df.filter(F.col(join_key) == skewed_key_value)
        right_skewed = right_df.filter(F.col(join_key) == skewed_key_value)
        
        # Add a salt column to spread the skewed key
        left_salted = left_skewed.withColumn(
            "salt", 
            F.spark_partition_id() % num_splits
        )
        
        # Replicate the right side for each salt value
        salted_right_skewed = []
        for i in range(num_splits):
            salted_right = right_skewed.withColumn("salt", F.lit(i))
            salted_right_skewed.append(salted_right)
        
        right_salted = reduce(lambda x, y: x.union(y), salted_right_skewed)
        
        # Join on both the original key and the salt
        current_joined = left_salted.join(
            right_salted, 
            [join_key, "salt"]
        ).drop("salt")
        
        # Union with previous results
        if skewed_joined is None:
            skewed_joined = current_joined
        else:
            skewed_joined = skewed_joined.union(current_joined)
    
    # Combine normal and skewed results
    final_joined = normal_joined.union(skewed_joined)
    
    return final_joined

```

#### Cache Optimization

Strategic use of caching for performance gains:

```python
# Analyze tables to see which would benefit from caching
def analyze_for_caching(tables, min_size_gb=1, max_size_gb=20):
    """
    Analyze tables to determine caching candidates
    """
    cache_candidates = []
    
    for table_name in tables:
        # Get table size
        table_size_bytes = spark.sql(f"DESCRIBE DETAIL {table_name}").select("sizeInBytes").collect()[0][0]
        table_size_gb = table_size_bytes / (1024 * 1024 * 1024)
        
        # Get access frequency (simplified - in production, use query history API)
        query_count = spark.sql(f"""
            SELECT COUNT(*) FROM system.query_history 
            WHERE query LIKE '%{table_name}%' 
            AND query_start_time > current_timestamp() - INTERVAL 7 DAYS
        """).collect()[0][0]
        
        # Check if table is a good candidate for caching
        if (table_size_gb >= min_size_gb and 
            table_size_gb <= max_size_gb and 
            query_count > 10):
            
            cache_candidates.append({
                "table_name": table_name,
                "size_gb": table_size_gb,
                "query_count": query_count,
                "priority_score": query_count / table_size_gb  # Higher is better
            })
    
    # Sort by priority score
    cache_candidates.sort(key=lambda x: x["priority_score"], reverse=True)
    
    return cache_candidates

# Cache tables with refresh strategy
def cache_with_refresh_strategy(table_name, refresh_interval_minutes=60):
    """
    Cache a table with a scheduled refresh
    """
    # Cache the table
    spark.sql(f"CACHE TABLE {table_name}")
    
    # Schedule a job to refresh the cache
    from datetime import datetime, timedelta
    
    refresh_job = {
        "name": f"Refresh Cache - {table_name}",
        "schedule": {
            "quartz_cron_expression": f"0 */{refresh_interval_minutes} * * * ?",
            "timezone_id": "UTC"
        },
        "tasks": [
            {
                "task_key": "refresh_cache",
                "sql_task": {
                    "query": f"REFRESH TABLE {table_name}",
                    "warehouse_id": "${warehouse_id}"
                }
            }
        ]
    }
    
    # Create job using Jobs API
    create_job(refresh_job)
```

#### Hands-on Exercise: Advanced Query Optimization

1. Analyze query performance using Spark UI
2. Identify and optimize skewed joins
3. Implement dynamic partition pruning
4. Set up strategic caching for frequently accessed tables
5. Measure and document performance improvements

### Resource Management and Isolation

#### Multi-Tenant Resource Allocation

Managing resources across teams and workloads:

```python
# Create isolated workspaces
def setup_isolated_workspace(team_name, users, workspace_url, token):
    """
    Set up an isolated workspace for a team
    """
    import requests
    import json
    
    # Create group for the team
    group_response = requests.post(
        f"{workspace_url}/api/2.0/groups/create",
        headers={"Authorization": f"Bearer {token}"},
        json={"group_name": f"{team_name}-group"}
    )
    
    group_id = group_response.json().get("group_id")
    
    # Add users to the group
    for user in users:
        requests.post(
            f"{workspace_url}/api/2.0/groups/add-member",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "group_id": group_id,
                "user_name": user
            }
        )
    
    # Create instance pool for the team
    pool_response = requests.post(
        f"{workspace_url}/api/2.0/instance-pools/create",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "instance_pool_name": f"{team_name}-pool",
            "node_type_id": "Standard_DS3_v2",
            "min_idle_instances": 2,
            "max_capacity": 20,
            "idle_instance_autotermination_minutes": 20,
            "enable_elastic_disk": True,
            "preloaded_spark_versions": ["11.3.x-scala2.12"]
        }
    )
    
    pool_id = pool_response.json().get("instance_pool_id")
    
    # Create cluster policy for the team
    policy_response = requests.post(
        f"{workspace_url}/api/2.0/policies/clusters/create",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": f"{team_name}-policy",
            "definition": json.dumps({
                "instance_pool_id": {
                    "type": "fixed",
                    "value": pool_id
                },
                "spark_version": {
                    "type": "regex",
                    "pattern": "11.[0-9].*"
                },
                "autoscale.min_workers": {
                    "type": "range",
                    "min": 1,
                    "max": 10
                },
                "autoscale.max_workers": {
                    "type": "range",
                    "min": 2,
                    "max": 20
                },
                "custom_tags.team": {
                    "type": "fixed",
                    "value": team_name
                }
            })
        }
    )
    
    policy_id = policy_response.json().get("policy_id")
    
    # Grant permissions to the group for the pool and policy
    requests.post(
        f"{workspace_url}/api/2.0/permissions/instance-pools/{pool_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "access_control_list": [
                {
                    "group_name": f"{team_name}-group",
                    "permission_level": "CAN_ATTACH_TO"
                }
            ]
        }
    )
    
    requests.post(
        f"{workspace_url}/api/2.0/permissions/cluster-policies/{policy_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "access_control_list": [
                {
                    "group_name": f"{team_name}-group",
                    "permission_level": "CAN_USE"
                }
            ]
        }
    )
    
    return {
        "group_id": group_id,
        "pool_id": pool_id,
        "policy_id": policy_id
    }
```

#### Resource Quotas and Limits

Setting up resource quotas for teams:

```python
# Configure workspace-level quotas
def set_team_quotas(team_name, max_dbus_per_day, max_concurrent_jobs, workspace_url, token):
    """
    Set resource quotas for a team
    """
    import requests
    
    # Get the group ID for the team
    group_response = requests.get(
        f"{workspace_url}/api/2.0/groups/list",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    groups = group_response.json().get("groups", [])
    team_group = next((g for g in groups if g["display_name"] == f"{team_name}-group"), None)
    
    if not team_group:
        raise Exception(f"Group for team {team_name} not found")
    
    group_id = team_group["id"]
    
    # Set job concurrency limit for the group
    requests.post(
        f"{workspace_url}/api/2.0/jobs/config",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "group_id": group_id,
            "max_concurrent_runs": max_concurrent_jobs
        }
    )
    
    # Set cluster quota policy
    policy_def = {
        "cluster_dbu_quota": {
            "type": "fixed",
            "value": str(max_dbus_per_day)
        },
        "cluster_size_quota": {
            "type": "fixed",
            "value": "enabled"
        }
    }
    
    # Update the cluster policy with quotas
    policies_response = requests.get(
        f"{workspace_url}/api/2.0/policies/clusters/list",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    policies = policies_response.json().get("policies", [])
    team_policy = next((p for p in policies if p["name"] == f"{team_name}-policy"), None)
    
    if team_policy:
        policy_id = team_policy["policy_id"]
        
        # Get current policy definition
        policy_response = requests.get(
            f"{workspace_url}/api/2.0/policies/clusters/get?policy_id={policy_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        current_def = json.loads(policy_response.json().get("definition", "{}"))
        
        # Update with quota settings
        current_def.update(policy_def)
        
        # Update the policy
        requests.post(
            f"{workspace_url}/api/2.0/policies/clusters/edit",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "policy_id": policy_id,
                "name": f"{team_name}-policy",
                "definition": json.dumps(current_def)
            }
        )
```

#### Hands-on Exercise: Resource Management

1. Set up isolated workspaces for different teams
2. Configure instance pools for workload isolation
3. Implement cluster policies with resource constraints
4. Set up job concurrency limits and DBU quotas
5. Monitor resource utilization across teams

## 6. Security and Governance Best Practices

### Advanced Security Configuration

#### Unity Catalog Setup

Configuring Unity Catalog for multi-level security:

```sql
-- Create a metastore
CREATE METASTORE main_metastore
COMMENT 'Main metastore for the organization'
LOCATION 's3://company-unity-catalog/main-metastore';

-- Create catalogs for different domains
CREATE CATALOG retail
COMMENT 'Retail domain data assets';

CREATE CATALOG finance
COMMENT 'Financial data and reporting';

-- Create schemas in catalogs
CREATE SCHEMA retail.raw
COMMENT 'Raw/Bronze layer data for retail';

CREATE SCHEMA retail.trusted
COMMENT 'Trusted/Silver layer for retail';

CREATE SCHEMA retail.curated
COMMENT 'Curated/Gold layer for retail';

-- Grant catalog permissions to groups
GRANT CREATE, USAGE ON CATALOG retail TO `retail_admins`;
GRANT USAGE ON CATALOG retail TO `retail_users`;

-- Grant schema permissions
GRANT CREATE, USAGE ON SCHEMA retail.raw TO `retail_engineers`;
GRANT USAGE ON SCHEMA retail.trusted TO `retail_analysts`;
GRANT USAGE ON SCHEMA retail.curated TO `retail_analysts`;

-- Set up external locations
CREATE EXTERNAL LOCATION retail_landing
URL 's3://company-data-lake/retail/landing'
WITH (CREDENTIAL aws_iam_role_retail);

GRANT READ FILES, WRITE FILES ON EXTERNAL LOCATION retail_landing TO `retail_engineers`;
```

#### Advanced Access Control

Implementing fine-grained access control:

```sql
-- Column-level security
CREATE TABLE finance.trusted.employee_data (
  employee_id STRING,
  name STRING,
  email STRING,
  department STRING,
  salary DOUBLE,
  hire_date DATE,
  manager_id STRING,
  address STRING,
  phone_number STRING,
  tax_id STRING
);

-- Grant access to specific columns only
GRANT SELECT ON TABLE finance.trusted.employee_data TO `hr_team`;
GRANT SELECT (employee_id, name, email, department, hire_date, manager_id) 
  ON TABLE finance.trusted.employee_data TO `managers`;

-- Row-level security with secure views
CREATE VIEW finance.curated.department_employees
AS SELECT 
  employee_id,
  name,
  email,
  department,
  hire_date,
  manager_id
FROM finance.trusted.employee_data
WHERE department IN 
  (SELECT allowed_departments FROM access_control.department_permissions 
   WHERE username = current_user());

-- Dynamic data masking
CREATE TABLE customers (
  customer_id STRING,
  name STRING,
  email STRING,
  address STRING,
  phone STRING,
  tax_id STRING,
  birth_date DATE,
  signup_date DATE
);

-- Create masked version
CREATE VIEW masked_customers
AS SELECT
  customer_id,
  CASE 
    WHEN is_member('pii_admins') THEN name
    ELSE regexp_replace(name, '(^\\w)\\w+\\s(\\w)\\w+', '$1*** $2***')
  END AS name,
  CASE
    WHEN is_member('pii_admins') THEN email
    ELSE regexp_replace(email, '(^\\w{1,2})\\w+(@.+)', '$1***$2')
  END AS email,
  CASE
    WHEN is_member('pii_admins') THEN address
    ELSE '*** Masked ***'
  END AS address,
  CASE
    WHEN is_member('pii_admins') THEN phone
    ELSE regexp_replace(phone, '\\d(?=\\d{4})', '*')
  END AS phone,
  CASE
    WHEN is_member('pii_admins') THEN tax_id
    ELSE '*** Masked ***'
  END AS tax_id,
  CASE
    WHEN is_member('pii_admins') THEN birth_date
    ELSE NULL
  END AS birth_date,
  signup_date
FROM customers;
```

#### Encryption and Key Management

Configuring encryption for sensitive data:

```python
# Set up encryption for a cluster
def create_encrypted_cluster(cluster_name, key_arn):
    """
    Create a cluster with encryption configuration
    """
    cluster_config = {
        "cluster_name": cluster_name,
        "spark_version": "11.3.x-scala2.12",
        "node_type_id": "Standard_DS3_v2",
        "autoscale": {
            "min_workers": 2,
            "max_workers": 8
        },
        "encryption": {
            "encryption_type": "AWS_KMS",
            "encryption_at_storage": {
                "aws_kms": {
                    "key_arn": key_arn
                }
            }
        },
        "spark_conf": {
            "spark.databricks.io.encryption.enabled": "true",
            "spark.databricks.io.encryption.keySources.aws.enabled": "true"
        }
    }
    
    response = requests.post(
        f"{workspace_url}/api/2.0/clusters/create",
        headers={"Authorization": f"Bearer {token}"},
        json=cluster_config
    )
    
    return response.json()

# Set up table-level encryption
def setup_table_encryption(table_name, catalog, schema, cmk_id):
    """
    Configure table-level encryption
    """
    # Create encrypted managed table
    spark.sql(f"""
    CREATE TABLE {catalog}.{schema}.{table_name} (
      id STRING,
      data STRING,
      sensitive_info STRING
    )
    TBLPROPERTIES (
      'encryption.algorithm' = 'AES_GCM_256',
      'encryption.key.id' = '{cmk_id}'
    )
    """)
    
    return f"Table {catalog}.{schema}.{table_name} created with encryption"
```

#### Hands-on Exercise: Security Implementation

1. Set up Unity Catalog with multi-level organization
2. Implement column-level security for sensitive data
3. Create dynamic masking views for PII
4. Configure encryption for data at rest and in transit
5. Audit and test security controls

### Data Governance and Compliance

#### Data Lineage Tracking

Implementing data lineage with Unity Catalog:

```python
# Query lineage information
def get_table_lineage(catalog_name, schema_name, table_name):
    """
    Get upstream and downstream lineage for a table
    """
    lineage_df = spark.sql(f"""
    SELECT *
    FROM system.information_schema.tables_column_lineage
    WHERE target_table_catalog = '{catalog_name}'
      AND target_table_schema = '{schema_name}'
      AND target_table_name = '{table_name}'
    ORDER BY target_column_name
    """)
    
    return lineage_df

# Extract lineage from DLT pipelines
def extract_dlt_lineage(pipeline_id):
    """
    Extract lineage information from a DLT pipeline
    """
    import requests
    
    # Get pipeline details
    pipeline_response = requests.get(
        f"{workspace_url}/api/2.0/pipelines/{pipeline_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    pipeline = pipeline_response.json()
    
    # Get latest update
    updates_response = requests.get(
        f"{workspace_url}/api/2.0/pipelines/{pipeline_id}/updates",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    updates = updates_response.json().get("updates", [])
    
    if updates:
        latest_update = updates[0]
        update_id = latest_update.get("update_id")
        
        # Get lineage from the latest update
        lineage_response = requests.get(
            f"{workspace_url}/api/2.0/lineage-tracking/table-lineages",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "pipeline_id": pipeline_id,
                "update_id": update_id
            }
        )
        
        return lineage_response.json()
    
    return None
```

#### Data Cataloging and Documentation

Setting up comprehensive data cataloging:

```python
# Create documentation for a table
def document_table(catalog, schema, table_name, description, tags=None, column_descriptions=None):
    """
    Add documentation to a table
    """
    # Set table description
    spark.sql(f"""
    COMMENT ON TABLE {catalog}.{schema}.{table_name} IS '{description}'
    """)
    
    # Set table properties for tags
    if tags:
        tags_str = ", ".join([f"'{k}': '{v}'" for k, v in tags.items()])
        spark.sql(f"""
        ALTER TABLE {catalog}.{schema}.{table_name} 
        SET TBLPROPERTIES ('tags' = '{{{tags_str}}}')
        """)
    
    # Set column descriptions
    if column_descriptions:
        for column, desc in column_descriptions.items():
            spark.sql(f"""
            COMMENT ON COLUMN {catalog}.{schema}.{table_name}.{column} IS '{desc}'
            """)
    
    return f"Documentation added for {catalog}.{schema}.{table_name}"

# Generate data dictionary
def generate_data_dictionary(catalog, schema=None, table=None):
    """
    Generate a data dictionary for the specified scope
    """
    if table:
        # Get table details
        table_details = spark.sql(f"""
        DESCRIBE TABLE EXTENDED {catalog}.{schema}.{table}
        """)
        
        # Get column details
        columns = spark.sql(f"""
        SELECT 
          column_name,
          data_type,
          comment
        FROM system.information_schema.columns
        WHERE table_catalog = '{catalog}'
          AND table_schema = '{schema}'
          AND table_name = '{table}'
        ORDER BY ordinal_position
        """)
        
        return {
            "table_name": f"{catalog}.{schema}.{table}",
            "details": {row["col_name"]: row["data_type"] for row in table_details.collect() if not row["col_name"].startswith("#")},
            "comment": spark.sql(f"SELECT comment FROM system.information_schema.tables WHERE table_catalog = '{catalog}' AND table_schema = '{schema}' AND table_name = '{table}'").collect()[0]["comment"],
            "columns": [{
                "name": row["column_name"],
                "type": row["data_type"],
                "description": row["comment"]
            } for row in columns.collect()]
        }
    elif schema:
        # Get all tables in the schema
        tables = spark.sql(f"""
        SELECT table_name, comment
        FROM system.information_schema.tables
        WHERE table_catalog = '{catalog}'
          AND table_schema = '{schema}'
        ORDER BY table_name
        """)
        
        result = {
            "schema_name": f"{catalog}.{schema}",
            "tables": [{
                "name": row["table_name"],
                "description": row["comment"]
            } for row in tables.collect()]
        }
        
        return result
    else:
        # Get all schemas in the catalog
        schemas = spark.sql(f"""
        SELECT schema_name
        FROM system.information_schema.schemata
        WHERE catalog_name = '{catalog}'
        ORDER BY schema_name
        """)
        
        result = {
            "catalog_name": catalog,
            "schemas": [{
                "name": row["schema_name"]
            } for row in schemas.collect()]
        }
        
        return result
```

#### Regulatory Compliance

Implementing controls for regulatory compliance:

```python
# PII detection function
def detect_pii(df, threshold=0.7):
    """
    Detect columns that may contain PII
    """
    from pyspark.sql import functions as F
    import re
    
    # Sample the dataframe
    sample_df = df.limit(1000)
    
    # Define patterns for common PII
    patterns = {
        "email": r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        "phone": r'(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}',
        "ssn": r'\d{3}-\d{2}-\d{4}',
        "credit_card": r'\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}',
        "ip_address": r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}',
        "address": r'\d+\s+[a-zA-Z]+\s+[a-zA-Z]+',
        "name": r'^[A-Z][a-z]+ [A-Z][a-z]+
    }
    
    results = []
    
    # Check each string column
    for col_name in df.schema.names:
        col_type = df.schema[col_name].dataType.simpleString()
        
        if "string" in col_type.lower():
            # Check each pattern
            for pii_type, pattern in patterns.items():
                # Count matches
                match_count = sample_df.filter(
                    F.col(col_name).rlike(pattern)
                ).count()
                
                match_pct = match_count / sample_df.count() if sample_df.count() > 0 else 0
                
                if match_pct >= threshold:
                    results.append({
                        "column_name": col_name,
                        "pii_type": pii_type,
                        "confidence": match_pct
                    })
    
    return results

# Anonymization function
def anonymize_pii(df, pii_columns):
    """
    Anonymize PII in a dataframe
    """
    from pyspark.sql import functions as F
    
    result_df = df
    
    # Apply appropriate anonymization technique for each column
    for col_info in pii_columns:
        col_name = col_info["column_name"]
        pii_type = col_info["pii_type"]
        
        if pii_type == "email":
            result_df = result_df.withColumn(
                col_name,
                F.regexp_replace(F.col(col_name), r'([^@\s]+)@', r'****@')
            )
        elif pii_type in ["phone", "ssn", "credit_card"]:
            result_df = result_df.withColumn(
                col_name,
                F.regexp_replace(F.col(col_name), r'\d(?=\d{4})', '*')
            )
        elif pii_type == "name":
            result_df = result_df.withColumn(
                col_name,
                F.concat(
                    F.substring(F.col(col_name), 1, 1),
                    F.lit("*** "),
                    F.substring_index(F.col(col_name), " ", -1)
                )
            )
        elif pii_type == "address":
            result_df = result_df.withColumn(
                col_name,
                F.lit("**** [REDACTED ADDRESS] ****")
            )
    
    return result_df
```

#### Hands-on Exercise: Data Governance Implementation

1. Set up data lineage tracking
2. Implement comprehensive data cataloging
3. Configure PII detection and protection
4. Set up audit logging and compliance reporting
5. Create governance dashboards

## Summary and Key Takeaways

This advanced training has covered critical aspects of optimizing and productionizing data engineering workflows on Databricks:

1. **Performance Optimization**: Techniques for improving query and pipeline performance, including physical layout optimization, Liquid Clustering, and handling data skew.

2. **Advanced Pipeline Patterns**: Implementation of complex patterns like SCD Type 2, CDC processing, and incremental aggregation for robust data pipelines.

3. **CI/CD for Data Engineering**: Setting up complete CI/CD pipelines with testing, automated deployment, and infrastructure as code.

4. **Monitoring and Observability**: Building comprehensive monitoring systems for performance, data quality, and incident management.

5. **Security and Governance**: Implementing Unity Catalog, fine-grained access control, and data governance practices for enterprise-grade data management.

By applying these advanced techniques, data engineers can build high-performance, resilient, and secure data pipelines that deliver reliable results at scale.

### Recommended Next Steps

1. Apply these techniques incrementally to your existing pipelines
2. Build a comprehensive CI/CD workflow for your data projects
3. Implement monitoring and governance frameworks
4. Pursue advanced Databricks certifications
5. Stay updated with new Databricks features and best practices