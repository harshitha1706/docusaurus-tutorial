### Sample pyspark programs
This simple code example queries the specified table and then shows the specified table's first 5 rows. To use a different table, adjust the call to spark.read.table.


### 1.To read table
```Python

from databricks.connect import DatabricksSession

spark = DatabricksSession.builder.getOrCreate()

df = spark.read.table("samples.nyctaxi.trips")
df.show(5)
```

:::tip
Can write programs in SQL, Python, R by using magic commands
:::

### Below are some sample programs

### 2.Checked sql query

```sql
%sql
select "I'm running sql"
```

### 3.To show sample datasets list
```python
display(dbutils.fs.ls("/databricks-datasets/"))
```

### 4.Create dataframe to retail datasets
```python
df1 = spark.read.option("header", True).csv("dbfs:/databricks-datasets/online_retail/data-001/data.csv")

```

### 5.Used cast and with column to change the column datatype
```python
from pyspark.sql.functions import col
df = df1.withColumn("InvoiceNo",df1["InvoiceNo"].cast("int"))
```


