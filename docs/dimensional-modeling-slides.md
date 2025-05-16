# Dimensional Data Modeling: An Introduction

## What is Dimensional Modeling?

- A technique used in data warehouse design
- Optimized for query performance and business analysis
- Focuses on representing data in an intuitive way for end users
- Simplifies complex data relationships for easier reporting
- Developed and popularized by Ralph Kimball

---

## Relational vs. Dimensional Modeling

| Relational Modeling | Dimensional Modeling |
|---------------------|----------------------|
| Optimized for OLTP (transactions) | Optimized for OLAP (analytics) |
| Normalized to reduce redundancy | Denormalized for query performance |
| Entity-relationship focused | Business process focused |
| Complex joins for analysis | Simpler star/snowflake schema |
| Current state of data | Historical perspective (includes time) |

---

## Core Components of Dimensional Models

### Fact Tables
- Contain quantitative business measurements
- Include foreign keys to dimension tables
- Typically have many rows but few columns
- Store numeric values that can be aggregated

### Dimension Tables
- Contain descriptive attributes
- Provide context for the facts
- Typically have fewer rows but many columns
- Support filtering, grouping, and labeling

---

## Example: Retail Sales Dimensional Model

**Fact Table: SALES_FACT**
- Sales_ID (PK)
- Date_Key (FK)
- Product_Key (FK)
- Store_Key (FK)
- Customer_Key (FK)
- Sales_Amount
- Quantity_Sold
- Discount_Amount
- Net_Profit

**Dimension Tables:**
- DATE_DIM
- PRODUCT_DIM
- STORE_DIM
- CUSTOMER_DIM

---

## Star Schema

A simple dimensional modeling pattern where a fact table connects directly to its dimension tables.

```
             +--------------+
             |  DATE_DIM    |
             +--------------+
                    |
                    |
+--------------+    |    +--------------+
| PRODUCT_DIM  |----+----| CUSTOMER_DIM |
+--------------+    |    +--------------+
                    |
                    |
             +--------------+
             |  SALES_FACT  |
             +--------------+
                    |
                    |
             +--------------+
             |  STORE_DIM   |
             +--------------+
```

---

## Snowflake Schema

An extension of the star schema where dimensions are normalized into multiple related tables.

```
                      +--------------+
                      |   DATE_DIM   |
                      +--------------+
                             |
                             |
  +--------------+           |           +--------------+
  | CATEGORY_DIM |           |           | REGION_DIM   |
  +--------------+           |           +--------------+
         |                   |                  |
         |                   |                  |
  +--------------+           |           +--------------+
  | PRODUCT_DIM  |-----------+-----------| STORE_DIM    |
  +--------------+           |           +--------------+
                             |
                             |
                      +--------------+
                      |  SALES_FACT  |
                      +--------------+
                             |
                             |
                      +--------------+
                      | CUSTOMER_DIM |
                      +--------------+
```

---

## Facts: Types and Examples

### 1. Transactional Facts
- Individual business events
- Highest level of detail
- Example: Individual sales transactions

```
SALES_TRANSACTION_FACT
- Transaction_ID: 1001
- Date_Key: 20230315
- Product_Key: 5001
- Store_Key: 102
- Customer_Key: 7654
- Sales_Amount: $45.99
- Quantity: 1
```

---

## Facts: Types and Examples (Continued)

### 2. Periodic Snapshot Facts
- Regular snapshots at defined intervals
- Captures state at a point in time
- Example: Monthly account balances

```
ACCOUNT_MONTHLY_SNAPSHOT_FACT
- Account_Key: 12345
- Date_Key: 20230131
- Balance_Amount: $5,432.10
- Interest_Amount: $12.50
- Status_Key: 1 (Active)
```

---

## Facts: Types and Examples (Continued)

### 3. Accumulating Snapshot Facts
- Track progress of a process with defined beginning and end
- Updated multiple times as process progresses
- Example: Order fulfillment process

```
ORDER_FULFILLMENT_FACT
- Order_Key: 8976
- Customer_Key: 1234
- Order_Date_Key: 20230310
- Payment_Date_Key: 20230311
- Shipping_Date_Key: 20230312
- Delivery_Date_Key: 20230315
- Order_Amount: $123.45
```

---

## Dimensions: Types and Examples

### 1. Conformed Dimensions
- Shared across multiple fact tables
- Enables integrated analysis
- Example: Calendar/Date dimension used across sales, inventory, and finance facts

```
DATE_DIM
- Date_Key: 20230315
- Full_Date: March 15, 2023
- Day_Of_Week: Wednesday
- Month_Name: March
- Quarter: Q1
- Year: 2023
- Is_Holiday: No
```

---

## Dimensions: Types and Examples (Continued)

### 2. Role-Playing Dimensions
- Same dimension used multiple times in different contexts
- Example: Date dimension used for order date, ship date, delivery date

```
ORDER_FACT
- Order_Key: 5432
- Order_Date_Key: 20230301 --> DATE_DIM
- Ship_Date_Key: 20230305 --> DATE_DIM
- Delivery_Date_Key: 20230308 --> DATE_DIM
- Order_Amount: $567.89
```

---

## Dimensions: Types and Examples (Continued)

### 3. Slowly Changing Dimensions (SCDs)
- Handles changes to dimension attributes over time
- Different types based on history tracking requirements
- Example: Customer changing address

**Type 1 SCD** (Overwrite)
- No history kept
- Current value only

**Type 2 SCD** (Add new row)
- Preserves history
- Multiple rows per entity
- Effective date ranges

---

## Type 2 SCD Example: CUSTOMER_DIM

| Customer_Key | Customer_ID | Name | Address | City | State | Valid_From | Valid_To | Current_Flag |
|--------------|------------|------|---------|------|-------|------------|----------|--------------|
| 10001 | C500 | John Smith | 123 Main St | Austin | TX | 2022-01-01 | 2023-02-15 | N |
| 10002 | C500 | John Smith | 456 Oak Ave | Dallas | TX | 2023-02-15 | 9999-12-31 | Y |

---

## Surrogate Keys

- Artificial keys used in dimensional models
- Replace business keys in fact tables
- Insulate from operational system changes
- Typically auto-incremented integers
- Enable slowly changing dimensions

Example:
- Natural key: Customer_ID = "CUST1234" 
- Surrogate key: Customer_Key = 5001

---

## Grain of Fact Tables

- The level of detail represented in the fact table
- Defines what a single row represents
- Determines what analyses are possible
- Should be consistent within a fact table

Examples:
- Individual sales transaction
- Daily product inventory balance
- Monthly customer account status

---

## Measures/Facts: Types and Calculation

### Additive
- Can be summed across ALL dimensions
- Example: Sales Amount, Quantity

### Semi-Additive
- Can be summed across some dimensions, but not time
- Example: Account Balance, Inventory Level

### Non-Additive
- Cannot be meaningfully summed
- Example: Ratios, Percentages, Unit Prices

---

## Factless Fact Tables

- Fact tables without numeric measures
- Record relationships or events
- Used to track occurrences or coverage

Examples:
- Student attendance (Student_Key, Date_Key, Class_Key)
- Product promotions (Product_Key, Promotion_Key, Date_Key)
- Doctor appointments (Doctor_Key, Patient_Key, Date_Key)

---

## Junk Dimensions

- Collect miscellaneous flags and indicators
- Groups low-cardinality attributes
- Reduces dimension bloat
- Often used for status indicators or classifications

Example: ORDER_STATUS_DIM
- Status_Key (PK)
- Is_Backorder (Y/N)
- Payment_Status (Paid/Unpaid)
- Shipping_Priority (Standard/Express)
- Gift_Wrap (Y/N)

---

## Degenerate Dimensions

- Dimension attributes stored directly in the fact table
- Typically transaction identifiers from source systems
- No associated dimension table

Example:
```
SALES_FACT
- Sales_Key (PK)
- Date_Key (FK)
- Product_Key (FK)
- Invoice_Number (Degenerate Dimension)
- Sales_Amount
- Quantity
```

---

## Example: Dimensional Model for Retail Sales

```
PRODUCT_DIM
- Product_Key (PK)
- Product_ID
- Product_Name
- Category
- Subcategory
- Brand
- Size
- Color
- Price

DATE_DIM
- Date_Key (PK)
- Full_Date
- Day_Of_Week
- Month
- Quarter
- Year
- Season
- Holiday_Flag

STORE_DIM
- Store_Key (PK)
- Store_ID
- Store_Name
- Address
- City
- State
- Country
- Store_Type
- Open_Date

SALES_FACT
- Sales_Key (PK)
- Date_Key (FK)
- Product_Key (FK)
- Store_Key (FK)
- Sales_Amount
- Quantity
- Discount
- Net_Profit
```

---

## Example Business Questions Answered

With this Sales dimensional model, users can answer:

- What were the total sales by product category for Q1 2023?
- Which stores had the highest sales growth compared to last year?
- How do sales vary by day of week across different store types?
- What products have the highest profit margin in each region?
- Which seasons have the highest sales for specific product categories?

---

## Dimensional Modeling Process

1. **Select Business Process** (Order Processing, Claims Processing, etc.)
2. **Declare Grain** (Level of detail in fact table)
3. **Identify Dimensions** (Who, What, When, Where, How)
4. **Identify Facts** (Measurements of the process)
5. **Create Star Schema** (Connect facts to dimensions)
6. **Add Dimension Attributes** (Descriptive information)
7. **Implement Tracking for Changes** (SCD types)
8. **Define Aggregates** (For performance)

---

## Real-World Example: Hospital Operations

**Fact Tables:**
- ADMISSION_FACT (admissions/discharges)
- TREATMENT_FACT (procedures, medications)
- BILLING_FACT (charges, payments)

**Dimension Tables:**
- PATIENT_DIM (demographics, insurance)
- PROVIDER_DIM (physicians, nurses)
- DATE_DIM (calendar attributes)
- TIME_DIM (hour, minute, shift)
- DIAGNOSIS_DIM (conditions, severity)
- LOCATION_DIM (department, room, bed)

---

## ETL for Dimensional Models

- **Extract**: Pull data from source systems
- **Transform**: Clean, convert, and conform data
- **Load**: Populate dimension and fact tables

Key ETL operations:
- Surrogate key assignment
- Dimension change processing (SCD handling)
- Fact table aggregation
- Data quality validation
- Incremental loading

---

## Common Dimensional Modeling Challenges

- Handling extremely large fact tables
- Balancing performance vs. storage
- Managing complex slowly changing dimensions
- Integrating data from disparate sources
- Handling irregular or sparse data
- Managing late-arriving facts or dimensions
- Designing for unknown future requirements

---

## Data Vault: Alternative to Dimensional Modeling

- Hybrid approach for enterprise data warehousing
- Highly adaptable to change
- Core components:
  - Hubs (business keys)
  - Links (relationships)
  - Satellites (descriptive attributes)
- Better for staging area than presentation layer

---

## When to Use Dimensional Modeling

**Best for:**
- Data warehouses and data marts
- Business intelligence and reporting
- Historical analysis
- Predictable query patterns
- End-user-facing applications

**Less suitable for:**
- Operational systems (OLTP)
- Complex transaction processing
- Data with highly variable structure
- Machine learning data pipelines (may require transformation)

---

## Benefits of Dimensional Modeling

- Predictable, standardized structure
- Query performance through denormalization
- Easily understood by business users
- Resilient to changes in business questions
- Supports historical analysis
- Enables consistent reporting across organization
- Facilitates drill-down and roll-up analysis

---

## Dimensional Modeling Tools

- **ERwin Data Modeler**: Enterprise data modeling
- **PowerDesigner**: Business process and data modeling
- **ER/Studio**: Data architecture and modeling
- **Lucidchart**: Visual modeling and diagramming
- **SqlDBM**: Cloud-based database modeling
- **DBDiagram**: Database diagrams using code
- **dbt**: Data transformation and modeling

---

## Summary

- Dimensional modeling optimizes for analytics and reporting
- Star and snowflake schemas provide intuitive structures
- Fact tables contain measurements; dimension tables provide context
- Different fact types for different business needs
- Surrogate keys and SCDs handle change management
- Grain defines the level of detail captured
- Focus is on user understanding and query performance

---

## Practice Exercise 1

Design a dimensional model for an e-commerce platform that tracks:
- Online orders
- Website visits
- Customer reviews
- Product inventory levels

Identify facts, dimensions, and appropriate grain for each fact table.

---

## Practice Exercise 2

For this sales data:

| Date | Store | Product | Category | Customer | Quantity | Amount |
|------|-------|---------|----------|----------|----------|--------|
| 2023-03-15 | Store A | Widget X | Electronics | John | 2 | $49.98 |
| 2023-03-15 | Store B | Gadget Y | Home | Mary | 1 | $24.99 |
| 2023-03-16 | Store A | Widget Z | Electronics | Susan | 3 | $89.97 |

Create a star schema with appropriate dimension and fact tables.
