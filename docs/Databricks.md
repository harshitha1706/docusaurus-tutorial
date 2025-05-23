# Databricks
### Table Of Contents
1. [Databricks installation](#section1)
2. [What is Databricks?](#section2)
3. [Technologies to Learn for Databricks](#section3)
4. [Real-Time Example](#section4)
5. [Where Databricks Fits in Project Development?](#section5)
6. [Databricks Overview](#section6)
7. [Summary](#section7)

---

<a id="section1"></a>
### Databricks installation
Check the [documentation](https://docs.databricks.com/aws/en/dev-tools/cli/install) for how to install Databricks.


<a id="section2"></a>
## What is Databricks?

Databricks is a cloud-based data analytics and AI platform built on Apache Spark. It helps businesses process, analyze, and visualize large amounts of data efficiently using Big Data, Machine Learning, and AI.

![Docusaurus](/img/dbgov.png)



--

<a id="section3"></a>
## Technologies to Learn for Databricks
To work with Databricks, you should have knowledge of:
1.	Big Data & Distributed Computing
-	Apache Spark (Core engine used by Databricks)
-	Hadoop (Optional, but useful for understanding data lakes)

2.	Programming Languages
-	Python (PySpark)
-	SQL (For querying structured data)
-	Scala (For advanced Spark development)

3.	Cloud Platforms (Since Databricks runs on the cloud)
-	Azure (Azure Databricks)
-	AWS (Databricks on AWS)
-	Google Cloud (Databricks on GCP)

4.	Data Engineering & ETL
-	Delta Lake (Databricks' optimized data lake storage)
-	Data ingestion tools like Apache Kafka, Airflow

5.	Machine Learning & AI (If working with AI models)
-	MLflow (Used for managing ML models in Databricks)

---

:::tip
Prerequistes are pyspark, SQL
:::

<a id="section4"></a>
## Real-Time Example:
Use Case: Fraud Detection in Banking
-	A bank processes millions of transactions daily.
-	They use Databricks to analyze real-time transaction data and identify fraudulent activities.
-	Steps: 
1.	Data is streamed into Databricks from transaction logs.
2.	Machine learning models (MLflow) analyze patterns.
3.	If a suspicious transaction is detected, an alert is triggered.
4.	The model keeps improving over time with more data.

---
<a id="section5"></a>
## Where Databricks Fits in Project Development?
Databricks is used in the Data Engineering & AI/ML stages of a project.
It mainly appears in the following phases:
1.	Data Collection – Ingest data from sources (databases, APIs, Kafka).
2.	Data Processing & Transformation – Clean and format data for analysis.
3.	Data Analysis & Visualization – Use Spark SQL and notebooks for insights.
4.	Machine Learning & AI – Train models using MLflow.
5.	Deployment & Monitoring – Deploy models and monitor performance.

---
<a id="section6"></a>
## Databricks Overview

| Feature                 | Description                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| Platform Type           | Unified Data Analytics Platform                                             |
| Primary Language        | Apache Spark (supports SQL, Python, R, Scala, Java)                        |
| Use Cases               | Data Engineering, Data Science, Machine Learning, BI                        |
| Key Components          | Notebooks, Jobs, Clusters, Delta Lake, MLflow                              |
| Data Storage            | Delta Lake (built on top of cloud object storage like S3, ADLS, GCS)       |
| Collaboration           | Shared Notebooks, Git Integration, Access Control                          |
| Integration             | Power BI, dbt, Tableau, Azure Synapse, Snowflake, etc.                     |
| Deployment Options      | AWS, Azure, GCP                                                             |
| Pricing Model           | Consumption-based (per DBU)                                                 |
| Security & Governance   | Unity Catalog, Role-Based Access Control (RBAC), Audit Logs                |

---
<a id="section7"></a>
## Summary
-	Databricks = Cloud-based Apache Spark platform for Big Data & AI.
-	Learn: Spark, Python/SQL, Cloud (Azure/AWS/GCP), MLflow.
-	Real-world use case: Fraud detection, recommendation systems, ETL processing.
-	Project stage: Data processing, ML model training, and deployment.
