# RS-19: AWS India Region Service Availability Matrix

**Document ID:** RS-19  
**Source:** AWS Regional Services Availability Documentation, SW-MVP-1.0 §34.2, §41 #2  
**Date Checked:** 20 October 2026  

---

## 1. Compliance & Data Residency Mandate
In accordance with `SW-MVP-1.0` §34.2 and India's Digital Personal Data Protection (DPDP) Act requirements, all student personal information, transit tracking logs, and audit records must be stored and processed within an AWS India region.

---

## 2. Infrastructure Service Availability Audit
The project requires the following AWS managed services in an India region (`AG-MASTER-1.0` Parts 2, 3, and 20.11):

| AWS Service | Architectural Role | Availability in AWS India Region | Operational Notes |
|---|---|:---:|---|
| **Amazon ECS on AWS Fargate** | Container orchestration for `services/api` and `services/worker` | **Available** | Supports Multi-AZ task placement (min 2 tasks across 2 availability zones). |
| **Application Load Balancer (ALB)** | HTTPS ingress, SSL termination, and host-based listener routing | **Available** | Handles both `api` and `ingest` domain routing. |
| **Amazon RDS for PostgreSQL** | Relational system of record (PostgreSQL 16 Multi-AZ) | **Available** | PostGIS extension (`CREATE EXTENSION postgis;`) is fully supported. Storage autoscaling enabled. |
| **Amazon S3** | Object storage for CSV import uploads and export reports | **Available** | S3 private buckets, Block Public Access enabled, KMS SSE-KMS encryption. |
| **Amazon SES v2** | Transactional email dispatch | **Available** | Production sending requires domain verification and quota increase. |
| **Amazon SNS** | Notification topics for SES bounce and complaint webhooks | **Available** | Connects to `POST /api/v1/webhooks/ses`. |
| **AWS KMS** | Customer-managed master keys (CMKs) for envelope encryption | **Available** | Field-level encryption for DOB, guardian contacts, and TOTP secrets. |
| **AWS WAF** | Web application firewall on ALB ingress | **Available** | Managed rule sets (Common Rule Set, Known Bad Inputs, IP Reputation). |
| **AWS Certificate Manager (ACM)** | Public TLS certificate generation and automatic renewal | **Available** | Enforces TLS 1.2+ minimum on ALB HTTPS listeners. |
| **AWS Secrets Manager** | Secure storage and 90-day rotation for API tokens & keys | **Available** | Stores DB credentials, HMAC keys, JWT signing keys. |
| **AWS Systems Manager Parameter Store**| Low-cost configuration storage for non-secret thresholds | **Available** | Holds system defaults from `AG-MASTER-1.0` Part 14.4. |
| **Amazon CloudFront** | Global/regional CDN serving static admin web console assets | **Global / Available** | Edge points of presence located throughout India. |
| **Amazon Route 53** | DNS resolution with low TTL (60s) for rapid ingress target failover| **Global / Available** | Managed DNS for `api`, `ingest`, and `admin` subdomains. |

---

## 3. Conclusion
All thirteen required AWS services are available in an India region with Multi-AZ redundancy, satisfying the non-functional requirements in `SW-MVP-1.0` §30 and deployment specifics in `SW-MVP-1.0` §34.
