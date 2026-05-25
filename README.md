# DevOps Project: Production-Grade 3-Tier Node.js + MongoDB Replica Set with NGINX & Full Monitoring Stack

**Author: Krrish Kumawat &nbsp;|&nbsp; Date: May 2026**

![NGINX](https://img.shields.io/badge/NGINX-009639?style=for-the-badge&logo=nginx&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB_7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js_18-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)

---

## Project Overview

In this project, I built a **fully containerized, production-grade 3-tier infrastructure** running on a local Ubuntu machine using Docker Compose. The stack includes:

- A **Node.js + Express** REST API with **bcrypt** password hashing for user auth (register/login)
- A **3-node MongoDB Replica Set** (`rs0`) with keyfile-based inter-node authentication
- **NGINX** as a reverse proxy with real **SSL termination** on a custom domain (`techkrrish.online`)
- A complete **Prometheus + Grafana** observability stack with host and MongoDB metrics auto-collected every 5 seconds

Everything communicates over a private Docker bridge network — the Node.js app is never directly exposed to the internet.

---

## Table of Contents

- [Architecture Diagram](#architecture-diagram)
- [Tech Stack](#tech-stack)
- [Step 1: Project Structure](#step-1-project-structure)
- [Step 2: MongoDB Replica Set Configuration](#step-2-mongodb-replica-set-configuration)
- [Step 3: Node.js Auth Application](#step-3-nodejs-auth-application)
- [Step 4: NGINX Reverse Proxy + SSL](#step-4-nginx-reverse-proxy--ssl)
- [Step 5: Monitoring Stack](#step-5-monitoring-stack)
- [Step 6: Bringing It All Up](#step-6-bringing-it-all-up)
- [API Reference](#api-reference)
- [Service Endpoints](#service-endpoints)
- [Common Commands](#common-commands)
- [Security Notes](#security-notes)
- [Conclusion](#conclusion)

---

## Architecture Diagram

![Architecture Diagram](assets/architecture.png)

```
  techkrrish.online
        │
   HTTP :80  ──► 301 Redirect to HTTPS
   HTTPS :443
        │
        ▼
┌─────────────────────────────────────────────────┐
│                  Docker Engine                  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │         NGINX (Port 80 / 443)             │  │
│  │  SSL: TLSv1.2 / TLSv1.3                  │  │
│  │  Cert: techkrrish.crt + ca_bundle.crt    │  │
│  └──────────────────┬────────────────────────┘  │
│                     │ proxy_pass                 │
│                     ▼                            │
│  ┌───────────────────────────────────────────┐  │
│  │      Node.js App  (Internal :3000)        │  │
│  │  Express + Mongoose + bcrypt              │  │
│  │  Routes: GET /  POST /register  POST /login│ │
│  └──────────────────┬────────────────────────┘  │
│                     │ MONGO_URI (replicaSet=rs0) │
│                     ▼                            │
│  ┌───────────────────────────────────────────┐  │
│  │       MongoDB Replica Set (rs0)           │  │
│  │   mongo1:5501 ── Primary                  │  │
│  │   mongo2:5502 ── Secondary                │  │
│  │   mongo3:5503 ── Secondary                │  │
│  │   Auth: keyFile + authorization enabled   │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │          Monitoring Stack                 │  │
│  │  Prometheus  :9090  scrape_interval: 5s   │  │
│  │  Grafana     :3001                        │  │
│  │  Node Exporter  :9100  (host metrics)     │  │
│  │  Mongo Exporter :9216  (MongoDB metrics)  │  │
│  └───────────────────────────────────────────┘  │
│                   [app-net bridge]              │
└─────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **OS** | Ubuntu | 22.04 LTS |
| **Containerization** | Docker + Docker Compose | v3.8 |
| **Reverse Proxy** | NGINX | latest |
| **Backend** | Node.js + Express.js | 18 / 4.18.2 |
| **Auth** | bcrypt | 5.1.0 |
| **ODM** | Mongoose | 7.0.0 |
| **Database** | MongoDB Replica Set | 7 |
| **Metrics Collection** | Prometheus | latest |
| **Visualization** | Grafana | latest |
| **Host Metrics** | Node Exporter | latest |
| **DB Metrics** | Percona MongoDB Exporter | 0.40 |

---

## Step 1: Project Structure

```
mongo-task/
├── docker-compose.yml              # Full stack orchestration
│
├── mongo/
│   ├── mongo1.conf                 # mongod config — port 5501
│   ├── mongo2.conf                 # mongod config — port 5502
│   ├── mongo3.conf                 # mongod config — port 5503
│   └── keyfile                     # Replica set auth keyfile (not committed)
│
├── nodeapp/
│   ├── server.js                   # Express app — auth API
│   ├── package.json                # Dependencies
│   └── Dockerfile                  # Node 18 image
│
├── nginx/
│   ├── nginx.conf                  # Reverse proxy + SSL config
│   ├── html/index.html             # Static page
│   └── ssl/                        # Real SSL certs (not committed)
│       ├── techkrrish.crt
│       ├── techkrrish.key
│       └── ca_bundle.crt
│
├── monitoring/
│   ├── prometheus.yml              # Scrape config (5s interval)
│   └── grafana/
│       └── provisioning/
│           ├── dashboards/dashboard.yml
│           └── datasources/prometheus.yml
│
├── data/                           # MongoDB data volumes (not committed)
│   ├── mongo1/
│   ├── mongo2/
│   └── mongo3/
│
└── assets/
    └── architecture.png
```

> `data/`, `mongo/keyfile`, and `nginx/ssl/` are all excluded via `.gitignore` — these must be generated locally after cloning.

---

## Step 2: MongoDB Replica Set Configuration

Each node has its own `mongod.conf`. All three are identical except for the port number.

**`mongo/mongo1.conf`:**

```yaml
storage:
  dbPath: /data/db

net:
  bindIp: 0.0.0.0
  port: 5501

replication:
  replSetName: rs0

security:
  keyFile: /etc/keyfile
  authorization: enabled
```

`mongo2.conf` uses port `5502`, `mongo3.conf` uses port `5503`.

### Generate the Keyfile

Keyfile secures communication between replica nodes. Generate once before starting:

```bash
openssl rand -base64 756 > mongo/keyfile
chmod 400 mongo/keyfile
```

### Initialize the Replica Set

Run this **one time only** after `docker compose up -d`:

```bash
docker exec -it mongo1 mongosh --port 5501 \
  -u admin -p admin123 --authenticationDatabase admin --eval '
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:5501" },
    { _id: 1, host: "mongo2:5502" },
    { _id: 2, host: "mongo3:5503" }
  ]
})'
```

Verify after ~10 seconds:

```bash
docker exec -it mongo1 mongosh --port 5501 \
  -u admin -p admin123 --authenticationDatabase admin \
  --eval 'rs.status()'
```

The `stateStr` for one node should show `PRIMARY` and the other two `SECONDARY`.

---

## Step 3: Node.js Auth Application

A lightweight Express API with user registration and login. Passwords are hashed with `bcrypt` before storing in MongoDB.

**`nodeapp/server.js`:**

```javascript
const express = require("express")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const app = express()
app.use(express.json())

// Connects to all 3 replica nodes
const uri = process.env.MONGO_URI ||
  "mongodb://admin:admin123@mongo1:5501,mongo2:5502,mongo3:5503/devopsdb?replicaSet=rs0&authSource=admin"

mongoose.connect(uri)

const User = mongoose.model("User", {
  username: String,
  password: String  // bcrypt hashed
})

app.get("/", (req, res) => res.send("DevOps Project Running"))

app.post("/register", async (req, res) => {
  const hashed = await bcrypt.hash(req.body.password, 10)
  const user = new User({ username: req.body.name, password: hashed })
  await user.save()
  res.send("User Registered")
})

app.post("/login", async (req, res) => {
  const user = await User.findOne({ username: req.body.username })
  if (!user) return res.send("User not found")
  const match = await bcrypt.compare(req.body.password, user.password)
  res.send(match ? "Login successful" : "Invalid password")
})

app.listen(3000, () => console.log("Server running"))
```

**`nodeapp/Dockerfile`:**

```dockerfile
FROM node:18
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

**`nodeapp/package.json`:**

```json
{
  "name": "devops-auth",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.0.0",
    "bcrypt": "^5.1.0"
  }
}
```

---

## Step 4: NGINX Reverse Proxy + SSL

NGINX handles all external traffic. HTTP is permanently redirected to HTTPS. SSL terminates at NGINX — the Node.js app only speaks plain HTTP internally.

**`nginx/nginx.conf`:**

```nginx
events {}

http {
    include /etc/nginx/mime.types;

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name techkrrish.online;
        return 301 https://$host$request_uri;
    }

    # HTTPS server with real SSL cert
    server {
        listen 443 ssl;
        server_name techkrrish.online;

        ssl_certificate      /etc/nginx/ssl/techkrrish.crt;
        ssl_certificate_key  /etc/nginx/ssl/techkrrish.key;
        ssl_trusted_certificate /etc/nginx/ssl/ca_bundle.crt;
        ssl_protocols TLSv1.2 TLSv1.3;

        location / {
            proxy_pass http://nodeapp:3000;
            proxy_http_version 1.1;
            proxy_set_header Host              $host;
            proxy_set_header X-Real-IP         $remote_addr;
            proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

> For local testing without a real domain, generate a self-signed cert:
> ```bash
> mkdir -p nginx/ssl
> openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
>   -keyout nginx/ssl/techkrrish.key \
>   -out nginx/ssl/techkrrish.crt -subj "/CN=localhost"
> ```

---

## Step 5: Monitoring Stack

### Prometheus

Scrapes metrics every **5 seconds** from 3 targets — itself, MongoDB, and the host system.

**`monitoring/prometheus.yml`:**

```yaml
global:
  scrape_interval: 5s
  evaluation_interval: 5s
  scrape_timeout: 4s

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: "mongodb"
    static_configs:
      - targets: ["mongo-exporter:9216"]
    metric_relabel_configs:
      - target_label: env
        replacement: "production"

  - job_name: "node"
    static_configs:
      - targets: ["node-exporter:9100"]
        labels:
          env: "production"
```

### Grafana

Grafana auto-provisions Prometheus as datasource and loads dashboards on first boot — no manual setup needed.

### What Gets Monitored

| Exporter | Metrics Collected |
|---|---|
| **Node Exporter** `:9100` | CPU usage, RAM, disk I/O, network throughput, filesystem |
| **MongoDB Exporter** `:9216` | Replica set state, connections, opcounters, replication lag |
| **Prometheus** `:9090` | Self-monitoring — scrape durations, targets up/down |

---

## Step 6: Bringing It All Up

### Prerequisites

- Docker ≥ 24.x and Docker Compose ≥ v2.x
- These ports must be free: `80`, `443`, `3000`, `3001`, `5501–5503`, `9090`, `9100`, `9216`

### Clone & Setup

```bash
git clone https://github.com/krrishkumawat11/3-tier-node-mongo-replica-aws.git
cd 3-tier-node-mongo-replica-aws

# 1. Generate MongoDB keyfile
openssl rand -base64 756 > mongo/keyfile
chmod 400 mongo/keyfile

# 2. Add SSL certs to nginx/ssl/ (or generate self-signed for local)
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/techkrrish.key \
  -out nginx/ssl/techkrrish.crt -subj "/CN=localhost"

# 3. Start the full stack
docker compose up -d

# 4. Initialize replica set (first time only)
docker exec -it mongo1 mongosh --port 5501 \
  -u admin -p admin123 --authenticationDatabase admin --eval '
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo1:5501" },
    { _id: 1, host: "mongo2:5502" },
    { _id: 2, host: "mongo3:5503" }
  ]
})'
```

---

## API Reference

Base URL: `https://techkrrish.online` (or `http://localhost:3000` directly)

### `GET /`
Health check.
```
Response: "DevOps Project Running"
```

### `POST /register`
Register a new user. Password is bcrypt-hashed (salt rounds: 10) before storing.

```bash
curl -X POST https://techkrrish.online/register \
  -H "Content-Type: application/json" \
  -d '{"name": "krrish", "password": "mypassword"}'
```
```
Response: "User Registered"
```

### `POST /login`
Login with username and password.

```bash
curl -X POST https://techkrrish.online/login \
  -H "Content-Type: application/json" \
  -d '{"username": "krrish", "password": "mypassword"}'
```
```
Response: "Login successful" / "Invalid password" / "User not found"
```

---

## Service Endpoints

| Service | URL | Credentials |
|---|---|---|
| **App (HTTPS)** | https://techkrrish.online | — |
| **App (HTTP redirect)** | http://techkrrish.online | → HTTPS |
| **Node.js direct** | http://localhost:3000 | — |
| **Grafana** | http://localhost:3001 | `admin` / `admin` |
| **Prometheus** | http://localhost:9090 | — |
| **Node Exporter** | http://localhost:9100/metrics | — |
| **MongoDB Exporter** | http://localhost:9216/metrics | — |

---

## Common Commands

```bash
# Start full stack
docker compose up -d

# Stop everything
docker compose down

# Live logs (all services)
docker compose logs -f

# Logs for a specific service
docker compose logs -f nodeapp

# Check replica set health
docker exec -it mongo1 mongosh --port 5501 \
  -u admin -p admin123 --authenticationDatabase admin \
  --eval 'rs.status()'

# Rebuild Node.js app after code changes
docker compose up -d --build nodeapp

# Restart NGINX (e.g. after cert update)
docker compose restart nginx

# Check which node is PRIMARY
docker exec -it mongo1 mongosh --port 5501 \
  -u admin -p admin123 --authenticationDatabase admin \
  --eval 'rs.isMaster().primary'
```

---

## Security Notes

- MongoDB credentials in `docker-compose.yml` are for **local development** — rotate before any public deployment
- `mongo/keyfile` and `nginx/ssl/` are in `.gitignore` — never committed
- Node.js app has **no direct public port** — all traffic must pass through NGINX
- MongoDB replica nodes authenticate with each other via **keyFile** — no unauthenticated inter-node traffic
- SSL uses **TLSv1.2 and TLSv1.3 only** — older protocols disabled in NGINX config

---

## Conclusion

This project demonstrates a complete production-style infrastructure running on a single Ubuntu machine:

- **High Availability DB** — 3-node MongoDB replica set with automatic primary election and failover
- **Secure API** — bcrypt password hashing, no plaintext credentials stored
- **Encrypted Traffic** — real SSL cert on `techkrrish.online`, HTTP strictly redirected to HTTPS
- **Full Observability** — Prometheus scraping host + MongoDB metrics every 5s, visualized in Grafana with auto-provisioned dashboards
- **Network Isolation** — all services on a private Docker bridge; only NGINX is internet-facing

---

## Key Learnings

- Configuring a MongoDB Replica Set with per-node `mongod.conf` and keyfile authentication inside Docker
- Writing a Node.js auth API with bcrypt and Mongoose connected to a replica set URI
- Setting up NGINX with real SSL certificates, CA bundle, and TLS protocol restrictions
- Wiring Prometheus exporters (Node + MongoDB) into Grafana with automatic provisioning
- Using Docker Compose networks to expose only what needs to be exposed

---

## Topics

`mongodb` `replica-set` `docker` `docker-compose` `nginx` `nodejs` `express` `bcrypt` `mongoose` `prometheus` `grafana` `monitoring` `ssl` `tls` `devops` `infrastructure` `self-hosted` `ubuntu` `containerization` `auth-api`
