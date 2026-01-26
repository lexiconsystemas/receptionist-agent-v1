# Receptionist Agent V1 - Operations Manual

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-25 | DevOps Team | Initial Release |
| 1.1 | 2026-01-26 | Operations | Added troubleshooting procedures |

---

## Executive Summary

The Receptionist Agent V1 is an enterprise-grade AI-powered after-hours receptionist system designed for urgent care facilities. This manual provides comprehensive operational procedures for system administration, monitoring, and maintenance.

## System Overview

### Architecture Components

- **Application Layer**: Node.js/Express server with business logic
- **Voice Processing**: RetellAI integration for speech recognition and synthesis
- **AI Intelligence**: Hathr.ai healthcare-focused LLM for conversation management
- **Telephony**: Twilio for inbound/outbound calls and SMS
- **Automation**: Keragon for healthcare workflow orchestration
- **Caching**: Redis for session management and scalability
- **Monitoring**: Comprehensive health checks and logging

### Service Dependencies

| Service | Criticality | SLA | Fallback |
|---------|-------------|-----|----------|
| **RetellAI** | Critical | 99.9% | Mock mode |
| **Twilio** | Critical | 99.9% | Error handling |
| **Keragon** | High | 99.5% | Local logging |
| **Hathr.ai** | Critical | 99.9% | Basic responses |
| **Redis** | High | 99.5% | In-memory fallback |

---

## Standard Operating Procedures (SOPs)

### SOP-001: System Startup

#### Purpose
To ensure proper system initialization and service availability.

#### Responsibility
- **Primary**: DevOps Engineer
- **Secondary**: System Administrator

#### Procedure

1. **Pre-Startup Checks**
   ```bash
   # Verify environment configuration
   cat .env | grep -E "(TWILIO|RETELL|KERAGON|HATHR)"
   
   # Check Redis connectivity
   redis-cli -h localhost -p 6379 ping
   
   # Validate SSL certificates
   openssl x509 -in /path/to/cert.crt -text -noout
   ```

2. **Service Startup**
   ```bash
   # Start Redis (if not running)
   docker-compose up -d redis
   
   # Start application
   docker-compose up -d app
   
   # Verify health status
   curl http://localhost:3000/health
   ```

3. **Post-Startup Validation**
   ```bash
   # Check all services
   docker-compose ps
   
   # Verify API connectivity
   curl -H "Authorization: Bearer $RETELL_API_KEY" \
        https://api.retellai.com/agents/$RETELL_AGENT_ID
   
   # Test webhook endpoints
   curl -X POST http://localhost:3000/webhook/retell \
        -H "Content-Type: application/json" \
        -d '{"event_type":"test"}'
   ```

#### Success Criteria
- All services show "healthy" status
- API endpoints respond within 2 seconds
- Webhook endpoints accept test requests
- No error messages in logs

---

### SOP-002: Health Monitoring

#### Purpose
To maintain system health and proactively identify issues.

#### Responsibility
- **Primary**: Operations Team
- **Secondary**: On-call Engineer

#### Monitoring Checklist

**Hourly Checks**
- [ ] Application health endpoint: `GET /health`
- [ ] Redis connectivity: `redis-cli ping`
- [ ] Error rate: <1% of total requests
- [ ] Response time: <2 seconds average
- [ ] Memory usage: <80% of allocated

**Daily Checks**
- [ ] Log review for critical errors
- [ ] API quota utilization
- [ ] Backup completion status
- [ ] Security scan results
- [ ] Performance trend analysis

**Weekly Checks**
- [ ] Capacity planning review
- [ ] Dependency security updates
- [ ] Disaster recovery test
- [ ] Documentation updates

#### Health Endpoint Responses

```json
// Healthy Response
{
  "status": "healthy",
  "timestamp": "2026-01-25T23:45:00.000Z",
  "checks": {
    "server": { "status": "healthy", "uptime": 86400 },
    "redis": { "status": "healthy", "latency": 2 },
    "filesystem": { "status": "healthy", "accessible": true }
  },
  "summary": {
    "total": 3,
    "healthy": 3,
    "unhealthy": 0,
    "critical": 0
  }
}

// Degraded Response
{
  "status": "degraded",
  "timestamp": "2026-01-25T23:45:00.000Z",
  "checks": {
    "server": { "status": "healthy", "uptime": 86400 },
    "redis": { "status": "unhealthy", "error": "Connection timeout" },
    "filesystem": { "status": "healthy", "accessible": true }
  },
  "summary": {
    "total": 3,
    "healthy": 2,
    "unhealthy": 1,
    "critical": 0
  }
}
```

---

### SOP-003: Incident Response

#### Purpose
To provide structured response to system incidents and outages.

#### Incident Severity Levels

| Severity | Definition | Response Time | Escalation |
|----------|------------|----------------|------------|
| **SEV-0** | Complete system outage | 15 minutes | Executive |
| **SEV-1** | Critical functionality down | 1 hour | Management |
| **SEV-2** | Significant degradation | 4 hours | Team Lead |
| **SEV-3** | Minor issues | 24 hours | Engineer |

#### Incident Response Flow

1. **Detection & Triage**
   ```bash
   # Monitor alerts
   kubectl get events -n receptionist-agent --sort-by='.lastTimestamp'
   
   # Check system status
   curl http://localhost:3000/health
   
   # Review recent logs
   docker-compose logs --tail=100 app | grep ERROR
   ```

2. **Assessment & Communication**
   ```bash
   # Create incident ticket
   # Notify stakeholders via Slack/Email
   # Update status page
   ```

3. **Containment & Resolution**
   ```bash
   # Isolate affected services
   kubectl scale deployment receptionist-agent --replicas=0 -n receptionist-agent
   
   # Apply fix
   kubectl set image deployment/receptionist-agent \
       receptionist-agent=receptionist-agent:fixed-version \
       -n receptionist-agent
   
   # Restore service
   kubectl scale deployment receptionist-agent --replicas=3 -n receptionist-agent
   ```

4. **Verification & Recovery**
   ```bash
   # Verify fix
   curl http://localhost:3000/health
   
   # Monitor for 30 minutes
   watch -n 30 'curl -s http://localhost:3000/health | jq .status'
   ```

5. **Post-Incident Review**
   - Document root cause
   - Update procedures
   - Implement preventive measures
   - Share lessons learned

---

### SOP-004: Backup & Recovery

#### Purpose
To ensure data protection and system recoverability.

#### Backup Schedule

| Data Type | Frequency | Retention | Storage |
|-----------|-----------|-----------|---------|
| **Redis Data** | Every 6 hours | 30 days | Cloud Storage |
| **Application Logs** | Daily | 90 days | Log Aggregator |
| **Configuration** | On change | 1 year | Git Repository |
| **SSL Certificates** | Monthly | 3 years | Secure Storage |

#### Backup Procedures

**Redis Backup**
```bash
#!/bin/bash
# redis-backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/redis"
CONTAINER_NAME="receptionist-agent_redis_1"

# Create backup directory
mkdir -p $BACKUP_DIR

# Trigger Redis save
docker exec $CONTAINER_NAME redis-cli BGSAVE

# Wait for save to complete
sleep 10

# Copy backup file
docker cp $CONTAINER_NAME:/data/dump.rdb $BACKUP_DIR/dump_$DATE.rdb

# Compress backup
gzip $BACKUP_DIR/dump_$DATE.rdb

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/dump_$DATE.rdb.gz s3://backups/redis/

# Clean local files older than 7 days
find $BACKUP_DIR -name "*.rdb.gz" -mtime +7 -delete

echo "Redis backup completed: dump_$DATE.rdb.gz"
```

**Configuration Backup**
```bash
#!/bin/bash
# config-backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/config"

mkdir -p $BACKUP_DIR

# Backup environment variables
cp .env $BACKUP_DIR/env_$DATE

# Backup Kubernetes configurations
kubectl get all -n receptionist-agent -o yaml > $BACKUP_DIR/k8s_$DATE.yaml

# Backup secrets (encrypted)
kubectl get secrets -n receptionist-agent -o yaml | \
  ansible-vault encrypt > $BACKUP_DIR/secrets_$DATE.yaml.vault

# Commit to Git (encrypted repository)
git add $BACKUP_DIR/
git commit -m "Configuration backup $DATE"
git push origin main

echo "Configuration backup completed: $DATE"
```

#### Recovery Procedures

**Redis Recovery**
```bash
#!/bin/bash
# redis-recovery.sh

BACKUP_FILE=$1
CONTAINER_NAME="receptionist-agent_redis_1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# Stop Redis
docker stop $CONTAINER_NAME

# Copy backup file
docker cp $BACKUP_FILE $CONTAINER_NAME:/data/dump.rdb

# Start Redis
docker start $CONTAINER_NAME

# Verify recovery
sleep 10
docker exec $CONTAINER_NAME redis-cli ping

echo "Redis recovery completed from $BACKUP_FILE"
```

**Full System Recovery**
```bash
#!/bin/bash
# system-recovery.sh

BACKUP_DATE=$1

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <YYYYMMDD>"
    exit 1
fi

# Restore Kubernetes configurations
kubectl apply -f /backups/config/k8s_$BACKUP_DATE.yaml

# Restore Redis data
./redis-recovery.sh /backups/redis/dump_$BACKUP_DATE.rdb.gz

# Verify system health
sleep 30
curl http://localhost:3000/health

echo "System recovery completed for $BACKUP_DATE"
```

---

### SOP-005: Performance Optimization

#### Purpose
To maintain optimal system performance and scalability.

#### Performance Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Response Time** | <500ms | >2s |
| **Error Rate** | <0.1% | >1% |
| **Memory Usage** | <70% | >85% |
| **CPU Usage** | <60% | >80% |
| **Concurrent Calls** | 100+ | N/A |
| **Redis Latency** | <5ms | >50ms |

#### Optimization Procedures

**Application Performance**
```bash
# Monitor application performance
docker stats --no-stream
kubectl top pods -n receptionist-agent

# Analyze memory usage
node --inspect=0.0.0.0:9229 src/index.js

# Profile CPU usage
clinic doctor -- node src/index.js
```

**Database Optimization**
```bash
# Redis performance tuning
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET timeout 300

# Monitor Redis performance
redis-cli --latency-history
redis-cli INFO memory
redis-cli INFO stats
```

**Scaling Procedures**
```bash
# Horizontal scaling
kubectl scale deployment receptionist-agent --replicas=5 -n receptionist-agent

# Vertical scaling
kubectl patch deployment receptionist-agent -n receptionist-agent -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "receptionist-agent",
          "resources": {
            "requests": {
              "memory": "1Gi",
              "cpu": "1000m"
            },
            "limits": {
              "memory": "2Gi",
              "cpu": "2000m"
            }
          }
        }]
      }
    }
  }
}'
```

---

## Security Procedures

### Security Monitoring

#### Daily Security Checklist
- [ ] Review authentication logs
- [ ] Check for unusual API usage patterns
- [ ] Verify SSL certificate validity
- [ ] Scan for security vulnerabilities
- [ ] Monitor webhook signature validation failures

#### Security Incident Response

1. **Immediate Actions**
   ```bash
   # Block suspicious IPs
   iptables -A INPUT -s SUSPICIOUS_IP -j DROP
   
   # Rotate compromised credentials
   # Update webhook secrets
   # Enable enhanced logging
   ```

2. **Investigation**
   ```bash
   # Review access logs
   grep "SUSPICIOUS_IP" /var/log/nginx/access.log
   
   # Check authentication attempts
   docker-compose logs app | grep "authentication"
   
   # Analyze webhook payloads
   grep "signature" logs/app.log | tail -50
   ```

3. **Recovery**
   ```bash
   # Update all credentials
   # Revoke compromised API keys
   # Deploy security patches
   # Restore from clean backup
   ```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: Service Not Responding

**Symptoms**
- Health endpoint returns 503
- Webhook timeouts
- High error rates

**Diagnosis**
```bash
# Check service status
docker-compose ps
kubectl get pods -n receptionist-agent

# Review logs
docker-compose logs app --tail=100
kubectl logs deployment/receptionist-agent -n receptionist-agent

# Check resource usage
docker stats
kubectl top pods -n receptionist-agent
```

**Solutions**
1. **Resource Exhaustion**
   ```bash
   # Scale up resources
   kubectl scale deployment receptionist-agent --replicas=5
   # Increase memory limits
   # Add more Redis memory
   ```

2. **Application Crash**
   ```bash
   # Restart service
   docker-compose restart app
   kubectl rollout restart deployment/receptionist-agent -n receptionist-agent
   ```

3. **Network Issues**
   ```bash
   # Check connectivity
   telnet localhost 3000
   nslookup api.retellai.com
   
   # Verify firewall rules
   iptables -L -n
   ```

#### Issue 2: Redis Connection Failures

**Symptoms**
- Circuit breaker open for Redis
- Session data loss
- Performance degradation

**Diagnosis**
```bash
# Test Redis connectivity
redis-cli -h localhost -p 6379 ping
redis-cli info server

# Check Redis logs
docker-compose logs redis
kubectl logs deployment/redis -n receptionist-agent

# Monitor Redis metrics
redis-cli --latency
redis-cli info memory
```

**Solutions**
1. **Redis Service Down**
   ```bash
   # Restart Redis
   docker-compose restart redis
   kubectl rollout restart deployment/redis -n receptionist-agent
   ```

2. **Memory Issues**
   ```bash
   # Clear Redis memory
   redis-cli FLUSHDB
   
   # Adjust memory limits
   redis-cli CONFIG SET maxmemory 512mb
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

3. **Network Problems**
   ```bash
   # Check network connectivity
   telnet redis-host 6379
   
   # Verify DNS resolution
   nslookup redis-service
   ```

#### Issue 3: API Integration Failures

**Symptoms**
- Webhook delivery failures
- External service errors
- Call processing failures

**Diagnosis**
```bash
# Test API connectivity
curl -H "Authorization: Bearer $RETELL_API_KEY" \
     https://api.retellai.com/agents/$RETELL_AGENT_ID

# Check webhook delivery
curl -X POST http://localhost:3000/webhook/retell \
     -H "Content-Type: application/json" \
     -H "X-Retell-Signature: test" \
     -d '{"event_type":"test"}'

# Review error logs
grep "ERROR" logs/app.log | tail -20
```

**Solutions**
1. **API Key Issues**
   ```bash
   # Verify API credentials
   echo $RETELL_API_KEY | wc -c
   
   # Test API access
   curl -H "Authorization: Bearer $RETELL_API_KEY" \
        https://api.retellai.com/agents
   ```

2. **Rate Limiting**
   ```bash
   # Check rate limits
   curl -I https://api.retellai.com/agents
   
   # Implement backoff
   # Review usage patterns
   ```

3. **Webhook Configuration**
   ```bash
   # Verify webhook URL
   curl -I http://your-domain.com/webhook/retell
   
   # Test signature validation
   # Check SSL certificates
   ```

---

## Maintenance Calendar

### Daily Tasks (00:00 UTC)
- [ ] Health check verification
- [ ] Error log review
- [ ] Performance metric analysis
- [ ] Backup completion verification

### Weekly Tasks (Sunday 02:00 UTC)
- [ ] Security patch application
- [ ] Dependency updates
- [ ] Capacity planning review
- [ ] Documentation updates

### Monthly Tasks (1st of month)
- [ ] Full system backup test
- [ ] Disaster recovery drill
- [ ] Security audit
- [ ] Performance optimization review

### Quarterly Tasks
- [ ] Architecture review
- [ ] Scalability assessment
- [ ] Cost optimization
- [ ] Compliance audit

---

## Emergency Contacts

| Role | Contact | Hours |
|------|---------|-------|
| **On-call Engineer** | +1-555-0001 | 24/7 |
| **DevOps Lead** | +1-555-0002 | 24/7 |
| **Security Team** | security@company.com | 24/7 |
| **Management** | manager@company.com | Business hours |

---

## Appendix

### A. Configuration Templates

[Environment variable templates and examples]

### B. Monitoring Dashboards

[Grafana dashboard configurations]

### C. Alert Rules

[Prometheus alert rule definitions]

### D. Runbooks

[Detailed runbooks for specific scenarios]

---

**Document Control**

- **Owner**: Operations Manager
- **Review Frequency**: Monthly
- **Approval**: DevOps Director
- **Distribution**: Operations Team, Management

**Next Review Date**: February 25, 2026
