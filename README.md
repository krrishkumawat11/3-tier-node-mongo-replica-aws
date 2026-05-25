# DevOps Project: Production-Grade MongoDB Replica Set with NGINX + Node.js on Docker Compose

**Author: Krrish Kumawat &nbsp;|&nbsp; Date: May 2026**

![NGINX](https://img.shields.io/badge/NGINX-009639?style=for-the-badge&logo=nginx&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white)

---

## Project Overview

In this project, I built a **production-grade, fully containerized infrastructure** on a local Ubuntu machine using Docker Compose. It includes a **3-node MongoDB Replica Set** with keyfile authentication, a **Node.js** backend served through **NGINX** as a reverse proxy with SSL termination, and a complete **Prometheus + Grafana** monitoring stack with automated metrics collection for both the host system and MongoDB.

---

## Table of Contents

- [Architecture Diagram](#architecture-diagram)
- [Tech Stack](#tech-stack)
- [Step 1: Project Structure](#step-1-project-structure)
- [Step 2: MongoDB Replica Set Configuration](#step-2-mongodb-replica-set-configuration)
- [Step 3: Node.js Application](#step-3-nodejs-application)
- [Step 4: NGINX Reverse Proxy + SSL](#step-4-nginx-reverse-proxy--ssl)
- [Step 5: Monitoring Stack](#step-5-monitoring-stack)
- [Step 6: Bringing It All Up](#step-6-bringing-it-all-up)
- [Service Endpoints](#service-endpoints)
- [Common Commands](#common-commands)
- [Conclusion](#conclusion)

---

## Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │              Ubuntu Machine                 │
                         │                                             │
  Internet               │   ┌──────────────────────────────────────┐  │
  HTTP/HTTPS ──────────► │   │          Docker Engine               │  │
                         │   │                                      │  │
                         │   │  ┌────────────────────────────────┐  │  │
                         │   │  │   NGINX  (Port 80 / 443)       │  │  │
                         │   │  │   Reverse Proxy + SSL          │  │  │
                         │   │  └───────────────┬────────────────┘  │  │
                         │   │                  │ proxy_pass        │  │
                         │   │                  ▼                   │  │
                         │   │  ┌────────────────────────────────┐  │  │
                         │   │  │   Node.js App  (Port 3000)     │  │  │
                         │   │  │   Internal only                │  │  │
                         │   │  └───────────────┬────────────────┘  │  │
                         │   │                  │ MONGO_URI         │  │
                         │   │                  ▼                   │  │
                         │   │  ┌────────────────────────────────┐  │  │
                         │   │  │    MongoDB Replica Set (rs0)   │  │  │
                         │   │  │  mongo1:5501  (Primary)        │  │  │
                         │   │  │  mongo2:5502  (Secondary)      │  │  │
                         │   │  │  mongo3:5503  (Secondary)      │  │  │
                         │   │  └────────────────────────────────┘  │  │
                         │   │                                      │  │
                         │   │  ┌──────────────────────────────┐    │  │
                         │   │  │     Monitoring Stack         │    │  │
                         │   │  │  Prometheus    :9090         │    │  │
                         │   │  │  Grafana       :3001         │    │  │
                         │   │  │  Node Exporter :9100         │    │  │
                         │   │  │  Mongo Exporter:9216         │    │  │
                         │   │  └──────────────────────────────┘    │  │
                         │   └──────────────────────────────────────┘  │
                         └─────────────────────────────────────────────┘
```

All services communicate over a single internal Docker bridge network: `app-net`.

---

## Tech Stack

| Tool | Purpose |
|---|---|
| **Ubuntu 22.04** | Host OS (local machine) |
| **Docker + Docker Compose v3.8** | Containerization & orchestration |
| **NGINX** | Reverse proxy + SSL termination |
| **Node.js** | Backend application (custom Dockerfile) |
| **MongoDB 7** | 3-node Replica Set with keyfile auth |
| **Prometheus** | Metrics collection & alerting |
| **Grafana** | Metrics visualization & dashboards |
| **Node Exporter** | Host system metrics (CPU, RAM, disk) |
| **MongoDB Exporter (Percona)** | MongoDB-specific metrics |

---

## Step 1: Project Structure

```
mongo-task/
├── docker-compose.yml              # Main orchestration file
│
├── mongo/
│   ├── mongo1.conf                 # mongod config — node 1
│   ├── mongo2.conf                 # mongod config — node 2
│   ├── mongo3.conf                 # mongod config — node 3
│   └── keyfile                     # Shared auth keyfile (NOT committed)
│
├── nodeapp/
│   ├── Dockerfile
│   ├── server.js
│   └── package.json
│
├── nginx/
│   ├── nginx.conf                  # Reverse proxy config
│   ├── html/
│   │   └── index.html
│   └── ssl/                        # SSL certs (NOT committed)
│       ├── nginx.crt
│       └── nginx.key
│
├── monitoring/
│   ├── prometheus.yml              # Prometheus scrape config
│   └── grafana/
│       └── provisioning/
│           ├── dashboards/
│           │   └── dashboard.yml
│           └── datasources/
│               └── prometheus.yml
│
└── data/                           # MongoDB data volumes (NOT committed)
    ├── mongo1/
    ├── mongo2/
    └── mongo3/
```

> **Note:** `data/`, `mongo/keyfile`, and `nginx/ssl/` are excluded via `.gitignore`. See the Security Notes section.

---

## Step 2: MongoDB Replica Set Configuration

Each MongoDB node gets its own config file. Example `mongo/mongo1.conf`:

```yaml
net:
  port: 5501
  bindIp: 0.0.0.0

replication:
  replSetName: "rs0"

security:
  keyFile: /etc/keyfile
  authorization: enabled
```

`mongo2.conf` and `mongo3.conf` use ports `5502` and `5503` respectively.

### Generate the Keyfile

The keyfile secures inter-node communication. Generate it once and set strict permissions:

```bash
openssl rand -base64 756 > mongo/keyfile
chmod 400 mongo/keyfile
```

### Initialize the Replica Set

After running `docker compose up -d`, run this **one time**:

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

---

## Step 3: Node.js Application

The Node.js app connects to the replica set via the full connection string passed as an environment variable:

```javascript
// server.js (excerpt)
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI);
```

**Dockerfile:**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

The `MONGO_URI` in `docker-compose.yml` points to all 3 replica nodes:

```
mongodb://admin:admin123@mongo1:5501,mongo2:5502,mongo3:5503/appdb?replicaSet=rs0&authSource=admin
```

---

## Step 4: NGINX Reverse Proxy + SSL

NGINX sits in front of the Node.js app, handling all external traffic and SSL termination.

```nginx
# nginx/nginx.conf (excerpt)
server {
    listen 80;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    ssl_certificate     /etc/nginx/ssl/nginx.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx.key;

    location / {
        proxy_pass http://nodeapp:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Generate Self-Signed SSL (for local testing)

```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/nginx.key \
  -out nginx/ssl/nginx.crt \
  -subj "/CN=localhost"
```

---

## Step 5: Monitoring Stack

### Prometheus

Scrape config at `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'mongodb'
    static_configs:
      - targets: ['mongo-exporter:9216']
```

### Grafana

Grafana is provisioned automatically — datasource and dashboards load on first startup from `monitoring/grafana/provisioning/`.

No manual setup needed after `docker compose up`.

### What Gets Monitored

| Exporter | Metrics |
|---|---|
| **Node Exporter** | CPU, memory, disk I/O, network throughput |
| **MongoDB Exporter** | Replica set state, connections, opcounters, replication lag |

---

## Step 6: Bringing It All Up

### Prerequisites

- Docker ≥ 24.x
- Docker Compose ≥ v2.x
- Ports available: `80`, `443`, `3000`, `3001`, `5501–5503`, `9090`, `9100`, `9216`

### Start the Stack

```bash
git clone https://github.com/<your-username>/mongo-task.git
cd mongo-task

# Generate keyfile
openssl rand -base64 756 > mongo/keyfile
chmod 400 mongo/keyfile

# Generate SSL certs (if no real certs available)
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/nginx.key -out nginx/ssl/nginx.crt -subj "/CN=localhost"

# Start everything
docker compose up -d

# Initialize replica set (first time only)
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

## Service Endpoints

| Service | URL | Credentials |
|---|---|---|
| **App (HTTP → HTTPS redirect)** | http://localhost | — |
| **App (HTTPS)** | https://localhost | — |
| **Grafana** | http://localhost:3001 | `admin` / `admin` |
| **Prometheus** | http://localhost:9090 | — |
| **Node Exporter Metrics** | http://localhost:9100/metrics | — |
| **MongoDB Exporter Metrics** | http://localhost:9216/metrics | — |

---

## Common Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs (all)
docker compose logs -f

# View logs for a specific service
docker compose logs -f nodeapp

# Check replica set health
docker exec -it mongo1 mongosh --port 5501 \
  -u admin -p admin123 --authenticationDatabase admin \
  --eval 'rs.status()'

# Rebuild Node.js app after code changes
docker compose up -d --build nodeapp

# Restart a single service
docker compose restart nginx
```

---

## Conclusion

This stack is now fully operational on a single Ubuntu machine. The setup demonstrates:

- **MongoDB High Availability** — 3-node replica set with automatic failover and keyfile-based auth
- **Secure Traffic** — NGINX handles all external requests with SSL termination; Node.js is never directly exposed
- **Full Observability** — Prometheus scrapes both host and MongoDB metrics; Grafana dashboards auto-provision on startup
- **Zero-Touch Orchestration** — Single `docker compose up -d` brings the entire stack online

---

## Key Learnings

- Configuring a MongoDB Replica Set with keyfile authentication inside Docker
- Writing per-node `mongod.conf` files and managing them via volume mounts
- Setting up NGINX as an SSL-terminating reverse proxy for a containerized backend
- Wiring Prometheus exporters (Node + MongoDB) into Grafana with automatic provisioning
- Using Docker Compose networks to isolate internal services from the outside world

---

## Topics

`mongodb` `replica-set` `docker` `docker-compose` `nginx` `nodejs` `prometheus` `grafana` `monitoring` `ssl` `devops` `infrastructure` `self-hosted` `ubuntu` `containerization`
