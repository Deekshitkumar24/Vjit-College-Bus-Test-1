# RB-09: DNS & CloudFront Failover

## 1. Purpose
Managing global edge caching, ACM SSL certificate renewal, and origin failover (Part 3.1, Decision L-5).

## 2. Architecture
- Route 53 alias records point to CloudFront distribution.
- CloudFront terminates TLS (ACM certificate in `us-east-1` per OV-5).
- ALB in `ap-south-1` acts as primary origin with health checks on `/health/ready`.

## 3. Origin Failover Procedure
1. If primary ALB is degraded, CloudFront Origin Group automatically diverts traffic to secondary origin.
2. If DNS records must be repointed, update Route 53 latency-based routing policies with TTL of 60 seconds.
