# Receptionist Agent V1 - Deployment Guide

## Overview

This document provides comprehensive deployment instructions for the Receptionist Agent V1 after-hours AI receptionist system. The system is designed for production deployment with enterprise-grade reliability, security, and scalability.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Environment Configuration](#environment-configuration)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Monitoring & Observability](#monitoring--observability)
6. [Security Configuration](#security-configuration)
7. [Troubleshooting](#troubleshooting)
8. [Maintenance Procedures](#maintenance-procedures)

---

## System Requirements

### Minimum Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage | 20 GB | 50 GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

- **Docker**: 20.10+ or **Kubernetes**: 1.24+
- **Redis**: 7.0+ (included in Docker Compose)
- **Node.js**: 18.0+ (included in container)
- **Operating System**: Linux (Ubuntu 20.04+, RHEL 8+)

### External Dependencies

| Service | Required | Purpose |
|---------|----------|---------|
| **RetellAI** | ✅ Required | Voice processing & AI conversation |
| **SignalWire** | ✅ Required | Telephony & SMS services |
| **Keragon** | ✅ Required | Healthcare workflow automation |
| **Hathr.ai** | ✅ Required | Healthcare-focused LLM |
| **Google Calendar** | Optional | Clinic hours reference |

---

## Environment Configuration

### 1. Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Copy template
cp .env.example .env

# Edit configuration
nano .env
```

### 2. Required Configuration

#### Core System
```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
MOCK_MODE=false
```

#### API Credentials
```env
# SignalWire Configuration
SIGNALWIRE_PROJECT_ID=your_signalwire_project_id
SIGNALWIRE_API_TOKEN=your_api_token_here
SIGNALWIRE_SPACE_URL=yourspace.signalwire.com
SIGNALWIRE_PHONE_NUMBER=+1xxxxxxxxxx

# RetellAI Configuration
RETELL_API_KEY=your_retell_api_key
RETELL_AGENT_ID=your_agent_id
RETELL_WEBHOOK_SECRET=your_webhook_secret

# Hathr.ai Configuration
HATHR_API_KEY=your_hathr_api_key
HATHR_API_URL=https://api.hathr.ai/v1
HATHR_MODEL_ID=your_model_id

# Keragon Configuration
KERAGON_API_KEY=your_keragon_api_key
KERAGON_WEBHOOK_URL=https://api.keragon.com/webhook/your_workflow_id
KERAGON_WORKSPACE_ID=your_workspace_id
```

#### Clinic Configuration
```env
CLINIC_NAME="Your Urgent Care Center"
CLINIC_ADDRESS="123 Main St, City, State ZIP"
CLINIC_PHONE=+1xxxxxxxxxx
CLINIC_HOURS="MON:08:00-20:00,TUE:08:00-20:00,WED:08:00-20:00,THU:08:00-20:00,FRI:08:00-20:00,SAT:09:00-17:00,SUN:10:00-16:00"
```

#### Security Configuration
```env
WEBHOOK_SIGNATURE_SECRET=your_webhook_signature_secret
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Docker Deployment

### 1. Quick Start (Production)

```bash
# Build and start production services
docker-compose up -d

# Verify deployment
docker-compose ps
curl http://localhost:3000/health
```

### 2. Development Deployment

```bash
# Start development environment with mocks
docker-compose --profile dev up app-dev

# View logs
docker-compose logs -f app-dev
```

### 3. Docker Compose Services

| Service | Purpose | Ports | Health Check |
|---------|---------|-------|--------------|
| **app** | Main application | 3000:3000 | HTTP /health |
| **redis** | Session/cache | 6379:6379 | Redis PING |
| **app-dev** | Development mode | 3000:3000 | HTTP /health |

### 4. Production Docker Commands

```bash
# Build production image
docker build -t receptionist-agent:latest .

# Run with environment file
docker run -d \
  --name receptionist-agent \
  --env-file .env \
  -p 3000:3000 \
  -v $(pwd)/logs:/app/logs \
  receptionist-agent:latest

# Scale with multiple instances
docker run -d --name receptionist-agent-2 \
  --env-file .env \
  -p 3001:3000 \
  -v $(pwd)/logs:/app/logs \
  receptionist-agent:latest
```

---

## Kubernetes Deployment

### 1. Namespace Configuration

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: receptionist-agent
  labels:
    name: receptionist-agent
```

### 2. ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: receptionist-config
  namespace: receptionist-agent
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
  CLINIC_NAME: "Your Urgent Care"
  CLINIC_ADDRESS: "123 Main St, City, State"
```

### 3. Secret

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: receptionist-secrets
  namespace: receptionist-agent
type: Opaque
data:
  SIGNALWIRE_PROJECT_ID: eW91cl9wcm9qZWN0X2lk  # Base64 encoded
  SIGNALWIRE_API_TOKEN: eW91cl9hcGlfdG9rZW4=
  SIGNALWIRE_SPACE_URL: eW91cnNwYWNlLnNpZ25hbHdpcmUuY29t
  RETELL_API_KEY: eW91cl9yZXRlbGxfYXBpX2tleQ==
```

### 4. Redis Deployment

```yaml
# redis.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: receptionist-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: receptionist-agent
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

### 5. Application Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: receptionist-agent
  namespace: receptionist-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: receptionist-agent
  template:
    metadata:
      labels:
        app: receptionist-agent
    spec:
      containers:
      - name: receptionist-agent
        image: receptionist-agent:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: receptionist-config
        - secretRef:
            name: receptionist-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: logs
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: receptionist-agent-service
  namespace: receptionist-agent
spec:
  selector:
    app: receptionist-agent
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### 6. Ingress Configuration

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: receptionist-agent-ingress
  namespace: receptionist-agent
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - api.yourclinic.com
    secretName: receptionist-agent-tls
  rules:
  - host: api.yourclinic.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: receptionist-agent-service
            port:
              number: 80
```

### 7. Deploy to Kubernetes

```bash
# Apply all configurations
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f redis.yaml
kubectl apply -f deployment.yaml
kubectl apply -f ingress.yaml

# Monitor deployment
kubectl get pods -n receptionist-agent
kubectl logs -f deployment/receptionist-agent -n receptionist-agent

# Check services
kubectl get svc -n receptionist-agent
kubectl describe ingress receptionist-agent-ingress -n receptionist-agent
```

---

## Monitoring & Observability

### 1. Health Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /health` | Overall system health | Detailed health status |
| `GET /ready` | Readiness probe | Ready/Not ready |
| `GET /live` | Liveness probe | Alive status |
| `GET /health?check=redis` | Specific service check | Redis health |

### 2. Log Management

#### Log Levels
- **ERROR**: Critical errors requiring immediate attention
- **WARN**: Warning messages that should be investigated
- **INFO**: General operational information
- **DEBUG**: Detailed debugging information

#### Log Structure
```json
{
  "timestamp": "2026-01-25T23:45:00.000Z",
  "level": "info",
  "service": "receptionist-agent-v1",
  "callId": "retell_call_abc123",
  "message": "Call processed successfully",
  "duration": 145,
  "disposition": "completed"
}
```

### 3. Metrics Collection

#### Application Metrics
- Request rate and response times
- Error rates by endpoint
- Call processing metrics
- Redis connection status
- Circuit breaker states

#### System Metrics
- CPU and memory usage
- Disk I/O and storage
- Network traffic
- Container health status

### 4. Alerting Configuration

#### Critical Alerts
- **Service Down**: Application not responding
- **High Error Rate**: >5% error rate over 5 minutes
- **Redis Connection Failed**: Redis unavailable
- **Circuit Breaker Open**: External service failures

#### Warning Alerts
- **High Memory Usage**: >80% memory utilization
- **High Response Time**: >2 second average response time
- **Failed Webhooks**: External service webhook failures

---

## Security Configuration

### 1. Network Security

#### Firewall Rules
```bash
# Allow HTTP/HTTPS traffic
ufw allow 80/tcp
ufw allow 443/tcp

# Allow application port (if not behind load balancer)
ufw allow 3000/tcp

# Allow Redis (internal only)
ufw allow from 10.0.0.0/8 to any port 6379
```

#### SSL/TLS Configuration
```nginx
# Nginx configuration
server {
    listen 443 ssl http2;
    server_name api.yourclinic.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Application Security

#### Webhook Security
- **Signature Validation**: All incoming webhooks validated with HMAC-SHA256
- **Rate Limiting**: Configurable rate limits per client
- **Input Sanitization**: All inputs validated and sanitized
- **PHI Protection**: Automatic removal of protected health information

#### Authentication
```env
# Webhook signature secrets
RETELL_WEBHOOK_SECRET=your_retell_webhook_secret
SIGNALWIRE_API_TOKEN=your_signalwire_api_token
WEBHOOK_SIGNATURE_SECRET=your_webhook_signature_secret
```

### 3. Data Protection

#### HIPAA Compliance
- **Data Minimization**: Only collect necessary information
- **Encryption**: All data encrypted in transit and at rest
- **Audit Logging**: Complete audit trail for all data access
- **Access Control**: Role-based access to sensitive data

#### Data Retention
```env
# Automatic data cleanup
DATA_RETENTION_DAYS=365
LOG_RETENTION_DAYS=90
TRANSCRIPT_RETENTION_DAYS=30
```

---

## Troubleshooting

### 1. Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose logs app
kubectl logs deployment/receptionist-agent -n receptionist-agent

# Verify configuration
docker-compose config
kubectl get configmap receptionist-config -o yaml
```

#### Redis Connection Issues
```bash
# Test Redis connection
redis-cli -h localhost -p 6379 ping

# Check Redis logs
docker-compose logs redis
kubectl logs deployment/redis -n receptionist-agent
```

#### API Integration Failures
```bash
# Test API connectivity
curl -H "Authorization: Bearer $RETELL_API_KEY" \
     https://api.retellai.com/agents/$RETELL_AGENT_ID

# Check webhook delivery
curl -X POST http://localhost:3000/webhook/retell \
     -H "Content-Type: application/json" \
     -d '{"event_type":"test","call_id":"test"}'
```

### 2. Performance Issues

#### High Response Times
```bash
# Check system resources
docker stats
kubectl top pods -n receptionist-agent

# Monitor Redis performance
redis-cli --latency-history
redis-cli info stats
```

#### Memory Leaks
```bash
# Monitor memory usage
watch -n 1 'docker stats --no-stream'
kubectl top pods --watch=true

# Generate heap dump
kill -USR2 <nodejs_pid>
```

### 3. Debug Mode

#### Enable Debug Logging
```env
LOG_LEVEL=debug
DEBUG=receptionist:*
```

#### Mock Mode Testing
```env
MOCK_MODE=true
USE_MOCKS=true
```

---

## Maintenance Procedures

### 1. Regular Maintenance

#### Daily Tasks
- **Health Checks**: Verify all services are operational
- **Log Review**: Check for errors and warnings
- **Performance Monitoring**: Review response times and error rates
- **Backup Verification**: Ensure backups are completing successfully

#### Weekly Tasks
- **Security Updates**: Apply security patches
- **Log Rotation**: Clean up old log files
- **Performance Analysis**: Review trends and identify issues
- **Capacity Planning**: Monitor resource utilization

#### Monthly Tasks
- **Dependency Updates**: Update npm packages and Docker images
- **Security Audit**: Review access logs and security events
- **Documentation Updates**: Update documentation as needed
- **Disaster Recovery Test**: Test backup and recovery procedures

### 2. Update Procedures

#### Application Updates
```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install
npm audit fix

# Rebuild and deploy
docker-compose build
docker-compose up -d

# Verify deployment
curl http://localhost:3000/health
```

#### Rolling Updates (Kubernetes)
```bash
# Update deployment
kubectl set image deployment/receptionist-agent \
    receptionist-agent=receptionist-agent:v2.0.0 \
    -n receptionist-agent

# Monitor rollout
kubectl rollout status deployment/receptionist-agent -n receptionist-agent

# Rollback if needed
kubectl rollout undo deployment/receptionist-agent -n receptionist-agent
```

### 3. Backup Procedures

#### Data Backup
```bash
# Backup Redis data
docker exec redis redis-cli BGSAVE
docker cp redis:/data/dump.rdb ./backups/

# Backup application logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/

# Backup configuration
cp .env ./backups/env-backup-$(date +%Y%m%d)
```

#### Configuration Backup
```bash
# Export Kubernetes configurations
kubectl get all -n receptionist-agent -o yaml > k8s-backup.yaml

# Backup secrets
kubectl get secrets -n receptionist-agent -o yaml > secrets-backup.yaml
```

---

## Support & Escalation

### 1. Support Channels

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| **Critical** | oncall@yourcompany.com | 15 minutes |
| **High** | support@yourcompany.com | 1 hour |
| **Medium** | support@yourcompany.com | 4 hours |
| **Low** | support@yourcompany.com | 24 hours |

### 2. Emergency Procedures

#### Service Outage
1. **Immediate Assessment**: Determine scope and impact
2. **Communication**: Notify stakeholders and users
3. **Isolation**: Prevent further damage
4. **Recovery**: Restore service using backup procedures
5. **Post-mortem**: Document root cause and prevention measures

#### Security Incident
1. **Containment**: Isolate affected systems
2. **Investigation**: Determine breach scope
3. **Notification**: Notify security team and authorities
4. **Remediation**: Patch vulnerabilities and restore systems
5. **Compliance**: Document for regulatory requirements

---

## Appendix

### A. Environment Variable Reference

[Complete list of all environment variables with descriptions]

### B. API Documentation

[Detailed API endpoint documentation]

### C. Monitoring Dashboard Setup

[Instructions for setting up Grafana/Prometheus dashboards]

### D. Compliance Checklist

[HIPAA compliance checklist and procedures]

---

**Document Version**: 1.0  
**Last Updated**: January 25, 2026  
**Next Review**: February 25, 2026  
**Approved by**: DevOps Team Lead
