# RS-19: AWS India Region Service Availability Matrix

**Document ID:** RS-19  
**Source URL:** [AWS Regional Services Availability](https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/)  
**Specification References:** `SW-MVP-1.0` §34.2, §41 #2; `AG-MASTER-1.0` Parts 2, 3, 18.1, 20.11  
**Date Checked:** 20 October 2026 (Re-confirmed 21 October 2026)  
**Status:** Conditional on multi-region provisioning requirement (ap-south-1 core + us-east-1 for CloudFront edge assets)

---

## 1. Compliance & Data Residency Mandate

In accordance with `SW-MVP-1.0` §34.2 and India's Digital Personal Data Protection (DPDP) Act requirements, all student personal information, transit tracking logs, and audit records must be stored and processed within an AWS India region (`ap-south-1` Mumbai).

---

## 2. Infrastructure Service Availability Audit in `ap-south-1`

The project requires the following AWS managed services in an India region (`AG-MASTER-1.0` Parts 2, 3, and 20.11):

| AWS Service                             | Architectural Role                                                  | Availability in `ap-south-1` (Mumbai) | Operational & Region Boundary Notes                                                              |
| --------------------------------------- | ------------------------------------------------------------------- | :-----------------------------------: | ------------------------------------------------------------------------------------------------ |
| **Amazon ECS on AWS Fargate**           | Container orchestration for `services/api` and `services/worker`    |             **Available**             | Supports Multi-AZ task placement (min 2 tasks across 2 availability zones).                      |
| **Application Load Balancer (ALB)**     | HTTPS ingress, SSL termination, and host-based listener routing     |             **Available**             | Handles both `api` and `ingest` domain routing with regional TLS certificates.                   |
| **Amazon RDS for PostgreSQL**           | Relational system of record (PostgreSQL 16 Multi-AZ)                |             **Available**             | PostGIS extension (`CREATE EXTENSION postgis;`) is fully supported. Storage autoscaling enabled. |
| **Amazon S3**                           | Object storage for CSV import uploads and export reports            |             **Available**             | S3 private buckets in Mumbai, Block Public Access enabled, KMS SSE-KMS encryption.               |
| **Amazon SES v2**                       | Transactional email dispatch                                        |             **Available**             | Production sending requires domain verification and quota increase in `ap-south-1`.              |
| **Amazon SNS**                          | Notification topics for SES bounce and complaint webhooks           |             **Available**             | Connects to `POST /api/v1/webhooks/ses`.                                                         |
| **AWS KMS**                             | Customer-managed master keys (CMKs) for envelope encryption         |             **Available**             | Field-level encryption for DOB, guardian contacts, and TOTP secrets in `ap-south-1`.             |
| **AWS WAF (Regional)**                  | Web application firewall on ALB ingress                             |             **Available**             | Regional Web ACL applied directly to Application Load Balancer in `ap-south-1`.                  |
| **AWS Certificate Manager (ACM)**       | Public TLS certificate generation for ALB                           |             **Available**             | Enforces TLS 1.2+ minimum on ALB HTTPS listeners (`api` and `ingest` endpoints).                 |
| **AWS Secrets Manager**                 | Secure storage and 90-day rotation for API tokens & keys            |             **Available**             | Stores DB credentials, HMAC keys, JWT signing keys in `ap-south-1`.                              |
| **AWS Systems Manager Parameter Store** | Low-cost configuration storage for non-secret thresholds            |             **Available**             | Holds system defaults from `AG-MASTER-1.0` Part 14.4.                                            |
| **Amazon CloudFront**                   | Global CDN serving static admin web console assets                  |        **Global Edge Points**         | Points of Presence across India (Mumbai, Chennai, New Delhi, Hyderabad, Bengaluru, Kolkata).     |
| **Amazon Route 53**                     | DNS resolution with low TTL (60s) for rapid ingress target failover |        **Global / Available**         | Managed DNS for `api`, `ingest`, and `admin` subdomains.                                         |

---

## 3. Critical Regional Boundary & Missing Services in `ap-south-1`

### 3.1 Services Missing / Not Supported in `ap-south-1` for CloudFront

While all backend processing and primary data stores exist natively in `ap-south-1`, AWS architecture enforces strict global constraints for CloudFront distributions:

1. **CloudFront ACM TLS Certificate:**
   - **Status in `ap-south-1`:** **NOT AVAILABLE / NOT SUPPORTED.**
   - **Constraint:** AWS Certificate Manager certificates used for custom domain names on CloudFront distributions **must be requested in `us-east-1` (N. Virginia)**. An ACM certificate generated in `ap-south-1` cannot be attached to a CloudFront distribution.
2. **CloudFront WAF Web ACL:**
   - **Status in `ap-south-1`:** **NOT AVAILABLE / NOT SUPPORTED.**
   - **Constraint:** AWS WAF Web ACLs attached to CloudFront distributions must be created with `Scope: CLOUDFRONT`, which resides exclusively in **`us-east-1` (Global)**. A regional Web ACL created in `ap-south-1` can only protect the ALB, not the CloudFront edge distribution.

### 3.2 Result & Conditional Architecture

**RS-19 is CONDITIONAL:**

- All application compute (`services/api`, `services/worker`), persistence (PostgreSQL RDS with PostGIS, S3), security KMS keys, secrets, and ALB ingress reside strictly in **`ap-south-1` (Mumbai)** to satisfy data residency and DPDP statutory requirements.
- The Terraform configuration (`infra/terraform`) must explicitly declare a secondary AWS provider block aliased to `us-east-1` (`aws.us-east-1`) solely to provision the CloudFront ACM certificate and the CloudFront WAF Web ACL.
