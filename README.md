# LinatrixSite — DevOps Infrastructure Project

## Overview

LinatrixSite is a production-style DevOps and infrastructure project built to demonstrate practical deployment engineering, automation, monitoring, and containerized application management.

The project combines:

* Linux server administration
* Docker containerization
* NGINX reverse proxy configuration
* GitHub Actions CI/CD
* Prometheus monitoring
* Grafana observability dashboards
* Firebase production hosting
* Git-based deployment workflows

---

# Infrastructure Architecture

## Production Layer

### Firebase Hosting

Used as the production hosting platform for:

* Static frontend delivery
* HTTPS support
* CDN distribution
* Production domain hosting

### Cloudflare / Domain Infrastructure

Configured for:

* Custom domain routing
* DNS management
* Production website accessibility

---

# Linux Infrastructure Environment

## Ubuntu Server (node3)

A dedicated Ubuntu Linux VM used as infrastructure and DevOps environment.

Responsibilities:

* Docker runtime
* Container orchestration
* Monitoring stack
* NGINX reverse proxy
* CI/CD deployment target

---

# Docker Containerization

## Application Container

The frontend application was containerized using Docker.

### Dockerfile

The application is packaged inside an NGINX container:

```dockerfile
FROM nginx:alpine

COPY public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

Docker Compose was used to:

* Build application containers
* Manage networking
* Expose ports
* Simplify deployment workflows

Deployment command:

```bash
docker-compose up -d --build
```

---

# NGINX Reverse Proxy

NGINX was configured as a reverse proxy server.

Responsibilities:

* Forward HTTP traffic
* Route requests to Docker containers
* Prepare environment for HTTPS/SSL
* Enable production-style architecture

Flow:

```text
User Request
     ↓
NGINX Reverse Proxy
     ↓
Docker Container
     ↓
Frontend Application
```

---

# GitHub Integration

## Git-Based Deployment Workflow

The Linux VM is connected directly to GitHub.

Workflow:

```text
Local Development
      ↓
Git Push
      ↓
GitHub Repository
      ↓
GitHub Actions CI/CD
      ↓
Linux VM Deployment
```

---

# CI/CD Pipeline

## GitHub Actions Automation

A deployment pipeline was created using GitHub Actions.

### Automated Deployment Steps

On every push to the `main` branch:

1. GitHub Actions connects to the Linux server
2. Pulls latest code changes
3. Stops existing containers
4. Rebuilds Docker containers
5. Restarts application automatically

### Workflow File

```yaml
name: Deploy to Node3

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master

        with:
          host: ${{ secrets.VM_IP }}
          username: ${{ secrets.VM_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}

          script: |
            cd /home/linatrixsite
            git pull
            docker-compose down
            docker-compose up -d --build
```

---

# Monitoring & Observability

## Prometheus

Prometheus was deployed for infrastructure metrics collection.

Monitored metrics include:

* CPU usage
* RAM utilization
* Container uptime
* Network activity
* Docker service metrics

---

## Grafana

Grafana was deployed as visualization platform.

Features:

* Real-time dashboards
* Infrastructure observability
* System resource visualization
* Monitoring panels

---

## Node Exporter

Node Exporter was added to expose Linux system metrics to Prometheus.

Collected host metrics:

* CPU
* Memory
* Filesystem
* Load averages
* Network statistics

---

# Monitoring Stack Architecture

```text
Linux Server
    ↓
Node Exporter
    ↓
Prometheus
    ↓
Grafana Dashboards
```

---

# Technologies Used

## Infrastructure

* Ubuntu Server
* Docker
* Docker Compose
* NGINX
* GitHub Actions
* Prometheus
* Grafana
* Node Exporter

## Hosting & Networking

* Firebase Hosting
* Cloudflare DNS
* Custom Domain Routing

## Development

* HTML
* CSS
* JavaScript
* Git
* GitHub

---

# Skills Demonstrated

## DevOps

* Linux server management
* Containerization
* Reverse proxy configuration
* CI/CD automation
* Infrastructure monitoring
* GitOps workflows
* Docker networking
* Service orchestration

## Cloud & Infrastructure

* Domain management
* Deployment pipelines
* Observability systems
* Production-style architecture
* Infrastructure troubleshooting

---

# Future Improvements

Planned next steps:

* Kubernetes deployment
* Terraform infrastructure automation
* Ansible provisioning
* SSL certificate automation
* Advanced monitoring alerts
* Multi-container microservices architecture
* Horizontal scaling
* Load balancing
* Centralized logging stack

---

# Project Purpose

This project was created to gain hands-on experience with real-world DevOps practices and infrastructure engineering concepts.

It demonstrates the ability to:

* Deploy applications in Linux environments
* Automate deployments
* Configure monitoring systems
* Manage Dockerized applications
* Build production-style infrastructure workflows
* Integrate GitHub-based CI/CD pipelines

## Rollback Testing (Phase 9)

Tested reverting a bad deployment via GitOps (editing Git, not the cluster
directly). Confirmed the core principle works: setting `frontend.replicas: 0`
in `values.yaml` and pushing caused ArgoCD to automatically scale the frontend
down with no manual `kubectl` intervention; reverting the value back to `1`
and pushing brought it back the same way.

**Finding during testing:** the GitLab CI pipeline rebuilds and re-tags
container images on every push to `main`, including config-only commits that
don't touch application code. This caused repeated merge conflicts in
`values.yaml` when manual edits and CI's automatic image-tag commits landed
close together. Future improvement: scope the CI pipeline's build stage to
only trigger on changes to `backend/` or `frontend/` source paths, not on
every push to `main`.
