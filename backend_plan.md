# backend\_plan.md

## 1. 💡 Overview

This backend system serves as a **unified data collaboration platform**. Its primary function is to abstract data access and manipulation across two distinct modes of operation, enabling real-time, secure, and collaborative data exploration and management:

* **External DB Explorer:** Acts as a secure, intermediary layer for users to connect to and collaborate on top of their **existing external databases** (e.g., Postgres, MongoDB). The backend manages the connections, schema discovery, query generation, and real-time updates.
* **Internal Mini-DB:** Provides a **fully managed, hosted database system** (similar to Notion/Airtable) for users without an existing external database. The backend handles the storage, schema, and all data operations.

The core complexity lies in creating a unified abstraction layer that can consistently apply features like **RBAC**, **Audit History**, and **View Transformations** regardless of whether the underlying data resides in an external system or the app's internal mini-DB.

---

## 2. 🏗️ High-Level Architecture

### Overall Backend Architecture

The backend will employ a **microservices/modular monolith** architecture to separate concerns, primarily between the **API Gateway/Core Services** and the **Database Adapter/Execution Engines**.



* **API Gateway:** Handles **Authentication**, **Rate Limiting**, and routes requests to the appropriate core service. It also terminates **WebSockets** for real-time traffic.
* **Core Service (REST/WebSocket):** Contains the main business logic, including **RBAC policy enforcement**, **Workspace/User Management**, and **View Definition** storage.
* **Data Abstraction Layer (DAL):** The critical component that receives logical query plans from the Core Service and translates/dispatches them to the appropriate **Execution Engine**.
* **External DB Adapters:** A set of modules/services responsible for connecting to and querying external databases (Postgres Adapter, Mongo Adapter, etc.).
* **Internal Mini-DB Execution Engine:** The dedicated service responsible for storing, querying, and managing the application's internal data.
* **Audit/History Service:** A dedicated, asynchronous service for recording all critical operations.

### Suggested Tech Stack

| Component | Technology | Justification |
| :--- | :--- | :--- |
| **Backend Core** | **Node.js/TypeScript** (e.g., NestJS/Fastify) | High performance for I/O-bound tasks (crucial for DB proxying) and strong type safety. |
| **Main Database** (for user metadata, internal schemas) | **PostgreSQL** | Robust, transactional, and supports advanced JSON features needed for storing flexible schema definitions. |
| **Internal Mini-DB Storage** | **PostgreSQL** (with separate schema/tenant isolation) or **ClickHouse** (for analytic views) | For base tables, a well-tuned PostgreSQL instance (or pool) is reliable. For large, complex, read-heavy views, a dedicated **OLAP DB** might be considered. |
| **Real-Time/Caching** | **Redis** | Used for session management, WebSocket Pub/Sub coordination, and query caching. |

### Unified Adapter Concept

The backend acts as a **Unified Data Adapter** via the **Data Abstraction Layer (DAL)**.

1.  The **Core Service** generates a **Logical Query Plan (LQP)** for any user request (e.g., `SELECT * FROM TableX JOIN TableY WHERE ...`). This LQP is DB-agnostic.
2.  The **DAL** receives the LQP and determines the target: **External DB** or **Internal Mini-DB**.
3.  For **External DBs**, the DAL passes the LQP to the specific **Database Adapter** (e.g., Postgres Adapter). This adapter translates the LQP into a **physical query** (e.g., a native SQL query or a MongoDB aggregation pipeline).
4.  For the **Internal Mini-DB**, the LQP is passed to the **Internal Mini-DB Execution Engine** for direct evaluation against its managed storage.

### Storage Choice and Strategy for the Internal Mini-DB

* **Choice:** **PostgreSQL** (preferred)
* **Strategy:** Utilize a multi-tenant isolation approach within the PostgreSQL instance. Each Workspace/Project would map to either:
    * A dedicated **Database Schema** (best isolation, preferred).
    * A set of tables prefixed by the Workspace ID.
* **Base Table Storage:** Each user-defined base table in the mini-DB would be a standard **PostgreSQL table**.
* **Row Storage:** Standard SQL rows with defined columns. The ability to add flexible data types is managed by the mini-DB schema model.

---

## 3. 🔌 Database Connectivity Layer (External DBs)

### Abstractions and Interfaces

A core **`IDatabaseAdapter`** interface is defined for all external DB integrations. This ensures the Core Service/DAL interacts with any database type using a consistent set of methods.

**Conceptual `IDatabaseAdapter` Operations:**

* **`connect(config: ConnectionConfig)`:** Establishes and verifies a connection.
* **`discoverSchema(scope: string)`:** Lists tables/collections, views, and their fields.
* **`executeLogicalQuery(lqp: LogicalQueryPlan)`:** Executes a read or write operation.

### Example Adapters

| Adapter | Behavior | Key Function |
| :--- | :--- | :--- |
| **Postgres/MySQL Adapter** | Translates LQP into native **SQL** queries, handles connection pooling, and escapes parameters. | `SELECT ... JOIN ... WHERE ...` generation. |
| **MongoDB Adapter** | Translates LQP into **Aggregation Pipelines** or basic Find/Update commands, manages connections/replica sets. | `db.collection.aggregate([...])` generation. |

### Connection Configuration Storage

* External connection configurations (URL, host, port, username, **password/key**) are stored in the main internal PostgreSQL database.
* **Security:** Sensitive credentials (passwords, keys) must be **encrypted at rest** using a strong encryption standard (e.g., AES-256-GCM) with a dedicated **Key Management Service (KMS)** or an environment-managed key.
* **Access:** Connection access is strictly linked to a **Workspace ID** and **User ID**, enforced by **RBAC**. Only authorized users can retrieve the configuration for use or modification.

### Schema Discovery

Schema discovery is the process of reflecting the structure of the external database:

* **Listing Databases:** The adapter should list the available database/schema names that the configured user has access to.
* **Listing Tables/Collections:** Uses native DB commands (`\dt` in Postgres, `db.getCollectionNames()` in Mongo) to fetch the list of available relational tables or NoSQL collections.
* **Getting Columns/Fields:** Fetches the detailed structure (name, data type, constraints) for a given table/collection (e.g., using `INFORMATION_SCHEMA.COLUMNS` in SQL or inspecting a sample of documents in MongoDB).
* **Caching:** Discovered external schemas are cached in the internal PostgreSQL DB and invalidated periodically or upon explicit user request.

---

## 4. 💾 Internal Mini-DB Design

The internal mini-DB schema is itself stored in the main PostgreSQL database as metadata.

### Conceptual Data Model

* **Workspaces/Projects:** Root entity for multi-tenancy. Links to users, roles, and all associated base tables.
* **Base Tables:** Metadata includes `table_id`, `workspace_id`, `table_name`, and a pointer to the **physical storage location** (e.g., the name of the dedicated table in the internal PostgreSQL instance).
* **Columns:** Metadata includes `column_id`, `table_id`, `column_name`, **`data_type`** (e.g., `string`, `number`, `boolean`, `date`), and **`configuration`** (e.g., validation rules, default values).
* **Rows:** The **physical row** in the internal PostgreSQL table. All rows belonging to one Base Table are stored together. No special representation is needed; it’s a standard relational row.
* **Views:** A crucial metadata object that defines a **dynamic query** on top of one or more Base Tables/External Connections.

### Representation of Joins and Computed Columns

These are stored as **structured JSON/JSONB** within the **View** metadata object, rather than raw SQL/code.

* **Joins:** An array of join specifications:
    * `source_table_id`
    * `target_table_id`
    * `join_type` (e.g., `INNER`, `LEFT`)
    * `on_condition` (e.g., `source_col_id = target_col_id`)
* **Computed Columns:** An array of column specifications:
    * `column_name`
    * `expression_type` (e.g., `formula`, `aggregation`)
    * `expression_definition` (e.g., `JSON-encoded Abstract Syntax Tree (AST)` of the formula like `col_A * col_B + 10`).

### View Evaluation

1.  When a user queries a **View**, the **Core Service** retrieves the stored **View Definition** (filters, sorts, joins, computed columns).
2.  The Core Service converts this definition into a **Logical Query Plan (LQP)**.
3.  The LQP is passed to the **Internal Mini-DB Execution Engine**.
4.  The Execution Engine generates and executes the **physical query** (e.g., a complex SQL query using `WITH` clauses or subqueries to handle joins and applying the computed column logic) against its internal PostgreSQL tables.
5.  Results are returned to the user.

---

## 5. 📞 API Design (Conceptual)

The API will be primarily **RESTful** over HTTP/S for management and CRUD operations, and utilize **WebSockets** for real-time data and presence.

### Auth & User Management

| Endpoint Group | Description |
| :--- | :--- |
| **`/api/v1/auth`** | Register, Login, Logout, Refresh Token, User Profile. |
| **`/api/v1/users`** | CRUD for users (Admin only), fetching user/session details. |

### Workspace & Project Management

| Endpoint Group | Description |
| :--- | :--- |
| **`/api/v1/workspaces`** | CRUD for workspaces. Invite/Remove users from a workspace, manage workspace roles. |
| **`/api/v1/projects`** | CRUD for projects (optional layer under workspace). |

### External DB Connections

| Endpoint Group | Description |
| :--- | :--- |
| **`/api/v1/connections`** | **POST**: Create a new connection configuration (encrypted storage). **PUT/DELETE**: Update/Delete existing connection. |
| **`/api/v1/connections/{id}/test`** | **POST**: Initiate a connection test (pings the external DB). |
| **`/api/v1/connections/{id}/schema`** | **GET**: List available tables/collections, views, and their columns (uses Schema Discovery). |
| **`/api/v1/connections/{id}/query`** | **POST**: Execute a **logical** read query against an external table/view, with parameters for pagination, sorting, and filtering. |

### Internal Mini-DB

| Endpoint Group | Description |
| :--- | :--- |
| **`/api/v1/tables`** | **POST/PUT/DELETE**: CRUD for Base Tables. |
| **`/api/v1/tables/{id}/columns`** | **POST/PUT/DELETE**: CRUD for Table Columns (defines schema). |
| **`/api/v1/tables/{id}/rows`** | **GET/POST/PUT/DELETE**: CRUD for Rows (data). Supports query parameters for filtering/sorting. |
| **`/api/v1/views`** | **POST/PUT/DELETE**: CRUD for View Definitions (metadata of filters/joins/etc.). |
| **`/api/v1/views/{id}/data`** | **GET**: Fetch the evaluated data from a View (always read-only). |

### Sharing Views as API

| Endpoint Group | Description |
| :--- | :--- |
| **`/api/v1/views/{id}/api`** | **POST/PUT**: Toggle and configure the read-only JSON API exposure. Defines API path, Auth mode, and API keys. |
| **`/public/views/{slug}/data`** | **GET**: The actual external-facing, read-only JSON API endpoint. |

---

## 6. 🔒 Role-Based Access Control (RBAC)

### Role Model

Roles are defined at the **Workspace** level:

* **Owner:** Full administrative rights, including deleting the workspace, managing billing, and assigning *Admin* roles.
* **Admin:** Can manage all users, external connections, and create/delete **Base Tables** and **Views**.
* **Editor:** Can create/update/delete **Rows** in Base Tables and create/edit **Views**.
* **Viewer:** Read-only access to Base Table data and Views.

### Permission Rules (Conceptual)

| Operation | Owner | Admin | Editor | Viewer |
| :--- | :--- | :--- | :--- | :--- |
| Manage External Connections | ✅ | ✅ | ❌ | ❌ |
| Create/Alter Base Tables | ✅ | ✅ | ❌ | ❌ |
| Edit/Delete Rows (Data) | ✅ | ✅ | ✅ | ❌ |
| Create/Alter Views | ✅ | ✅ | ✅ | ❌ |
| Share Views as API | ✅ | ✅ | ❌ | ❌ |
| Read View Data | ✅ | ✅ | ✅ | ✅ |

### RBAC Enforcement

RBAC is enforced using a **Policy Layer** in the **Core Service**.

1.  **Authentication Middleware:** Verifies the user's identity (e.g., valid JWT).
2.  **Authorization Middleware:** Retrieves the user's **Role** for the requested **Workspace/Project**.
3.  **Policy Layer Check:** Before executing any business logic (e.g., updating a row), the Policy Layer is queried: `can(user_id, action, resource_id)`.
4.  **Data Filtering:** For data-read operations (e.g., viewing a table), the enforcement is often **row-level** (e.g., a "Viewer" might only see rows they created, if defined) or enforced at the **Logical Query Plan** generation stage (e.g., preventing access to sensitive columns).

---

## 7. 🚀 Real-Time Collaboration

### Strategy for WebSockets

We'll use a **WebSockets service** (e.g., built on **Socket.io** or native WebSockets with a framework like NestJS) hosted alongside the REST API. This service uses **Redis Pub/Sub** to coordinate events across horizontally scaled backend instances.

### Rooms/Namespaces

Collaboration is scoped using "rooms":

* **Namespace:** `/{workspace_id}`
* **Rooms:**
    * `/data/{table_id}`: For changes to a specific Base Table or External Table data.
    * `/view/{view_id}`: For changes to a specific View's definition (filters, sorts, etc.).
    * `/presence/{resource_id}`: For user presence/cursor movements within a resource.

### Real-Time Events

| Event Type | Description | Channels/Rooms |
| :--- | :--- | :--- |
| **`data:update`** | Notifies clients of a row/cell change (e.g., `{row_id: 123, field: 'status', value: 'Completed'}`). | `/data/{table_id}` |
| **`schema:update`** | Notifies clients of schema changes (e.g., column added/renamed). | `/data/{table_id}`, `/view/{view_id}` |
| **`user:join` / `user:leave`** | Indicates a user has started/stopped viewing a specific resource. | `/presence/{resource_id}` |
| **`user:cursor`** | Broadcasts the position of a user's cursor or selection. | `/presence/{resource_id}` |

### Conflict Resolution

For concurrent cell/row edits, we will employ a **Last-Write-Wins (LWW)** strategy with **Optimistic Locking**.

1.  Each row in the internal Mini-DB (and possibly external DB rows if supported) has a **version number** or a **timestamp**.
2.  When a client sends an update, it must include the **current version/timestamp** of the row it is trying to update.
3.  The backend checks: If the stored version matches the client's version, the update is committed, and the version is incremented. Otherwise, the update is rejected as a conflict, forcing the client to fetch the latest data and re-apply their change.

---

## 8. 📜 Audit Logging & History

### Conceptual Data Model for Audit Logs

The Audit Service stores records in a dedicated, optimized, append-only table (e.g., a separate PostgreSQL table or a simple document store).

| Field | Description |
| :--- | :--- |
| `log_id` | Unique ID. |
| `timestamp` | UTC time of the action. |
| `user_id` | The actor (who). |
| `workspace_id` | Context (where). |
| `action_type` | The operation (what) - e.g., `ROW_UPDATE`, `TABLE_CREATE`, `PERMISSION_CHANGE`. |
| `resource_id` | The affected entity (e.g., `table_id`, `connection_id`). |
| `before_state` | JSON/JSONB capturing the state *before* the change (optional for read ops). |
| `after_state` | JSON/JSONB capturing the state *after* the change. |

### Operations Logged

Critical operations include:

* **Schema Changes:** Creating/altering/deleting tables, columns, views.
* **Data Updates:** Creating/updating/deleting rows (including the old and new cell values).
* **Permission Changes:** User role updates, connection management.
* **Connection Usage:** Successful/failed attempts to connect to external DBs.

### Querying Audit History

The Audit Service exposes API endpoints allowing filtering by `user_id`, `action_type`, and `resource_id` within a time range. These queries are served from the dedicated audit log store.

### Strategy for Revert/Rollback

**Soft Deletes and Versioning:**

* **Schema Revert:** Revert a schema change by looking up the `before_state` of the schema definition in the audit log and applying it.
* **Data Revert:** For the internal Mini-DB, data is typically reverted by finding the necessary sequence of `ROW_UPDATE` or `ROW_DELETE` operations and executing their inverse. This often requires complex transactional logic or leveraging database-specific features like PostgreSQL's point-in-time recovery (PITR) for large-scale loss. For simplicity, row-level reverts will use the `before_state` from the audit log to re-insert/re-update the specific row.

---

## 9. 🌐 View as API

### Conceptual Mapping

The **View Definition** metadata object is the sole source of truth for the API endpoint:

$$\text{View Definition} \xrightarrow{\text{API Configuration}} \text{API Endpoint Metadata} \xrightarrow{\text{Request Time}} \text{Logical Query Plan} \xrightarrow{\text{Execution}} \text{JSON Response}$$

When a request hits the public API endpoint (`/public/views/{slug}/data`), a lightweight service:

1.  Validates the **API Key/Token** based on the view's configured Auth mode.
2.  Retrieves the complete **View Definition**.
3.  Generates a **Logical Query Plan (LQP)**, incorporating any request-time URL parameters (e.g., dynamic filters, sorts) while respecting the base View Definition.

### Execution Pipeline

The LQP then flows through the **Data Abstraction Layer (DAL)** for execution:

1.  **LQP Generation:** Includes base filters, sorts, and joins defined in the View metadata.
2.  **DB Execution:** The LQP is translated into a physical query by the appropriate adapter (Internal Mini-DB or External DB Adapter).
3.  **Post-Processing:**
    * The raw result set is received.
    * **Computed Columns** are calculated *in-memory* by the Execution Engine if the underlying database cannot handle the formula logic efficiently.
    * The final data is formatted as JSON and returned.

### Caching Strategy

Performance for public, read-only view APIs is critical.

* **TTL/Time-Based Caching:** Use **Redis** to cache the final JSON response of frequently accessed views. The cache key would include the `view_id` and all unique query parameters.
* **Invalidation:** The cache must be explicitly cleared whenever the underlying **Base Table data** changes, the **External Data** is known to change (e.g., via webhooks/polling, if available), or the **View Definition** is updated.
* **Stale-While-Revalidate:** For high-traffic views, a stale response can be served while a fresh version is generated asynchronously.

---

## 10. 🛡️ Security

### Authentication Strategy

* **REST/Core Services:** Use **JSON Web Tokens (JWTs)**. Upon successful login, the user receives a short-lived **Access Token** and a long-lived **Refresh Token**. The Access Token is used in the `Authorization: Bearer` header for all requests.
* **WebSockets:** The initial WebSocket connection handshake must include the Access Token for authentication.
* **View as API:** Use long-lived, randomly generated **API Keys** stored in a hashed form (like passwords).

### Multi-Tenant Isolation

* All data storage (internal schemas, metadata, external connection details) is strictly partitioned by **`workspace_id`**.
* Every API request's Authorization layer must ensure the requesting user is a member of the requested resource's workspace.
* For the Internal Mini-DB, access is isolated via PostgreSQL **Schema-level separation**.

### External DB Credentials Storage

* As detailed in Section 3, all sensitive credentials are **encrypted at rest** using a robust encryption scheme with a KMS-backed key.
* Credentials are only decrypted in-memory by the dedicated **Database Adapter** service right before a connection is established, minimizing exposure.

### Input Validation & Injection Protection

* **Parameterized Queries (SQL Injection):** The **Database Adapters** must *never* construct raw SQL/NoSQL queries using string concatenation with user input. All physical query generation must utilize **parameterized query APIs** (e.g., prepared statements) or safe driver-level methods.
* **XSS/Input:** All user-supplied input (table names, column names, formula expressions) must be strictly validated for permitted characters and lengths. Output rendering must always escape data to prevent **Cross-Site Scripting (XSS)**.

---

## 11. 📈 Scalability & Performance

### Horizontal Scalability

The architecture is designed to be **stateless** across the Core Service and API Gateway.

* **Core Service:** Can be scaled horizontally by adding more instances behind a load balancer. State is externalized to **PostgreSQL** and **Redis**.
* **Internal Mini-DB:** The dedicated PostgreSQL cluster/pool will require careful management (read replicas, connection pooling, optimized indexing).

### WebSocket Layer Scaling

* **Sticky Sessions:** The load balancer should utilize **sticky sessions** to route a client's subsequent WebSocket frames to the same backend instance.
* **Redis Pub/Sub:** **Redis** acts as the central message broker. When an event occurs on one Core Service instance (e.g., a data update), it publishes the event to Redis, and all other connected instances subscribe and fan out the event to their connected clients.

### Query Performance Considerations

| Scenario | Mitigation Strategy |
| :--- | :--- |
| **Large Tables** | Enforce and optimize **Pagination** (e.g., cursor-based pagination for large data sets). |
| **Complex Joins** | Implement **query timeouts**. For Internal Mini-DB, ensure proper indexing of join columns. For External DBs, rely on the underlying DB's query optimizer but limit the complexity in the LQP. |
| **Many Computed Columns** | Cache computed column definitions. Perform complex/costly computations asynchronously or offload them to a dedicated processing service. |
| **External DB Latency** | Implement aggressive connection pooling, query caching (as per Section 9), and expose latency metrics. |

* **Indexing Guidance:** For the Internal Mini-DB, automatically create B-tree indices on primary keys and user-specified foreign key/unique columns. Offer a UI/API for users to suggest additional indices on frequently filtered/sorted columns.

---

## 12. ☁️ DevOps & Environments

### Environment Strategy

* **Dev:** Local environments or shared cloud environments with test data, focused on rapid iteration.
* **Staging:** Near-production clone (schema and scale) for integration testing, load testing, and UAT before deployment.
* **Production:** The live environment.
* Deployment is managed via **Infrastructure as Code (IaC)** (e.g., Terraform) and **Containerization** (e.g., Docker) deployed on a managed Kubernetes cluster (EKS/GKE/AKS).

### Logging, Monitoring, and Alerting

* **Logging:** Use structured logging (e.g., JSON logs) throughout all services (Core, Adapters, WebSocket). Aggregate logs into a centralized system (e.g., ELK Stack or Datadog) for analysis. Log levels (DEBUG, INFO, WARN, ERROR) are strictly defined.
* **Monitoring:** Implement robust **APM (Application Performance Monitoring)** to track latency, error rates, and throughput for all critical endpoints, including the External DB Adapter calls. Monitor DB-specific metrics (query times, connection pool usage).
* **Alerting:** Set up alerts for: high error rates, critical service failures, external DB connection failures, slow query detection (threshold-based), and capacity/resource utilization (CPU/Memory/Disk).

### Backup Strategy for the Internal Mini-DB

* **Snapshot Backups:** Daily, full backups of the entire internal PostgreSQL database cluster.
* **Point-in-Time Recovery (PITR):** Enable continuous archiving of the PostgreSQL transaction log (WAL files) to allow recovery to any point in time within the retention window (e.g., 7-14 days).
* **Testing:** Regularly (e.g., monthly) test the restoration process to ensure integrity and recovery time objectives (RTO) are met.