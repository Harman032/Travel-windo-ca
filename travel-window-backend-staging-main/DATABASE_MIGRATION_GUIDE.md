# Database Migration & Troubleshooting Guide

This guide describes how to run the database migration scripts in this project, and how to troubleshoot common MongoDB Atlas connectivity issues (such as DNS SRV resolver errors) that can occur during execution.

---

## 📋 Migration Scripts Overview

There are two primary migration scripts located in the backend folder:

1. **`migrate-db.js`**
   - **Purpose**: Backfills schema additions to legacy bookings in the database.
   - **Modifications performed**:
     - Backfills a default `cancellation` object if the field is missing.
     - Initializes administrative and accounting verification flags: `verifiedByAdmin`, `verifiedByAccount`, `adminVerified`, and `accountVerified` to `false` if they are missing.
     - (Optional) Contains a commented block to migrate legacy payment modes (e.g. from "Credit Card" to "Machine Charge").

2. **`migrate-drafts.js`**
   - **Purpose**: Updates legacy booking statuses.
   - **Modifications performed**:
     - Finds all bookings with a status of `"Draft"` and transitions them to `"Pending Verification"`.

---

## 🚀 How to Run the Migration Scripts

Follow these steps to safely run the scripts on either **Staging** or **Production**:

### Step 1: Secure a Database Backup
Before performing any batch write/update operations on a live database, **always back up or export the collections** (e.g., using MongoDB Atlas backup options or `mongodump`).

### Step 2: Prepare the Connection String
Inside both `migrate-db.js` and `migrate-drafts.js`, there is a `MONGO_URI` variable:
```javascript
const MONGO_URI = "your-connection-string-here";
```
1. Replace this placeholder with the connection string for your target database.
2. **CRITICAL**: Ensure that the database name is specified correctly in the path. For example, if you want to target the database `travel_window_staging` or `travel_window_production`, make sure it is appended in the URI right before the query parameters (`?`):
   - **Correct**: `mongodb://.../travel_window_staging?ssl=true...`
   - **Incorrect**: `mongodb://.../?ssl=true...` (If omitted, Mongoose will default to writing to a database named `test`).

### Step 3: Run the Scripts
Execute the scripts using Node.js from the root of the backend folder:
```powershell
# To backfill cancellation objects and verification flags:
node migrate-db.js

# To migrate Draft bookings to Pending Verification:
node migrate-drafts.js
```

---

## 🔍 Troubleshooting: Connection & DNS Issues

### The Problem: `querySrv ECONNREFUSED`
When running the scripts, you might encounter a connection failure like this:
```
Connecting to Database...
Migration failed: Error: querySrv ECONNREFUSED _mongodb._tcp.travel.ia5scqz.mongodb.net
    at QueryReqWrap.onresolve [as oncomplete] (node:internal/dns/promises:294:17) {
  errno: undefined,
  code: 'ECONNREFUSED',
  syscall: 'querySrv',
  hostname: '_mongodb._tcp.travel.ia5scqz.mongodb.net'
}
```

#### Why it happens
The default MongoDB Atlas connection string uses the `mongodb+srv://` protocol. This protocol relies on **DNS SRV records** to resolve the actual hostnames of the MongoDB replica set. 
Many local network providers, home routers, and mobile ISPs block or fail to resolve SRV records due to custom DNS configurations or firewalls. This causes Node's DNS library to fail with `ECONNREFUSED`.

---

### Solutions

#### Solution 1: Use a Standard (Legacy) Connection String (Recommended)
The most robust solution is to bypass SRV records entirely by using the standard `mongodb://` protocol (which explicitly lists the hostname/IP of each replica set member instead of relying on a DNS lookup).

1. Log in to **MongoDB Atlas**.
2. Click **Connect** on your Database Cluster.
3. Select **Drivers** under "Connect to your application".
4. Set the Node.js Driver version to **2.2.12 or later** (instead of the latest version).
5. Copy the generated connection string. It will look like this:
   ```
   mongodb://<username>:<password>@ac-ojbycph-shard-00-00.ia5scqz.mongodb.net:27017,ac-ojbycph-shard-00-01.ia5scqz.mongodb.net:27017,ac-ojbycph-shard-00-02.ia5scqz.mongodb.net:27017/travel_window_staging?ssl=true&authSource=admin&replicaSet=atlas-zxy2il-shard-0&w=majority
   ```
6. Paste this standard string into the `MONGO_URI` field of your migration scripts.
> [!IMPORTANT]
> Make sure to replace `<username>` and `<password>` with your database user credentials, and ensure the target database name (e.g. `travel_window_staging` or `travel_window_production`) is present before the `?` query parameters.

---

#### Solution 2: Change Windows DNS Settings
If you want to continue using the `mongodb+srv://` connection string, you can configure your operating system to use a public DNS server (like Google or Cloudflare) that supports SRV resolving.

**On Windows:**
1. Open the **Run** dialog (`Win + R`), type `ncpa.cpl` and press Enter to open Network Connections.
2. Right-click on your active network adapter (e.g., Wi-Fi or Ethernet) and select **Properties**.
3. Select **Internet Protocol Version 4 (TCP/IPv4)** and click **Properties**.
4. Check **Use the following DNS server addresses** and enter:
   - **Preferred DNS server**: `8.8.8.8` (Google DNS)
   - **Alternate DNS server**: `8.8.4.4`
5. Click **OK** to save.
6. Open your terminal and try running the script again.

---

#### Solution 3: Manually Reconstruct the Connection String
If you cannot change your DNS server and do not have access to the MongoDB Atlas console to copy the legacy string, you can resolve the records manually via PowerShell to construct the standard string.

1. Open PowerShell and run this command to find the replica set members:
   ```powershell
   Resolve-DnsName -Name _mongodb._tcp.travel.ia5scqz.mongodb.net -Type SRV
   ```
   This will output the individual hostnames (e.g., `ac-ojbycph-shard-00-00...:27017`, `ac-ojbycph-shard-00-01...:27017`, etc.).
2. Run this command to query the replica set name (`replicaSet` parameter):
   ```powershell
   Resolve-DnsName -Name travel.ia5scqz.mongodb.net -Type TXT
   ```
   This returns a string containing options like `replicaSet=atlas-zxy2il-shard-0` and `authSource=admin`.
3. Combine these details manually to build a `mongodb://` string in this structure:
   ```
   mongodb://<username>:<password>@<host1>:27017,<host2>:27017,<host3>:27017/<dbname>?ssl=true&authSource=admin&replicaSet=<replicaSet>&w=majority
   ```
