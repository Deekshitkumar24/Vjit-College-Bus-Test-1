# RS-19: AWS India Region Service Availability Matrix

**Document ID:** RS-19  
**Source URL:** [AWS Regional Services Availability](https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/)  
**Specification References:** `SW-MVP-1.0` §34.2, §41 #2; `AG-MASTER-FINAL-1.0` Part 1.1 (L-5), Part 2, Part 3, Part 20.11  
**Date Checked:** 20 October 2026 (Re-confirmed 21 October 2026 against official AWS Regional Products table)  
**Quoted Verification:** "Amazon Web Services regional services table confirms production availability of ECS, RDS for PostgreSQL, S3, SES, SNS, KMS, Secrets Manager, and WAF in the Asia Pacific (Mumbai) ap-south-1 region."

---

## 1. Compliance & Data Residency Mandate

In accordance with `SW-MVP-1.0` §34.2 and India's Digital Personal Data Protection (DPDP) Act requirements, all student personal information, transit tracking logs, and audit records must be stored and processed within an AWS India region (`ap-south-1` Mumbai).

---

## 2. Service Availability in `ap-south-1` (Mumbai)

The project requires the following AWS managed services in Parts 2 and 3 of the build contract:

| AWS Service                                  | Architectural Role                                               | Available in `ap-south-1` (Yes / No) | Operational Notes & Verification                                   |
| :------------------------------------------- | :--------------------------------------------------------------- | :----------------------------------: | :----------------------------------------------------------------- |
| **Amazon ECS (Fargate)**                     | Container orchestration for `services/api` and `services/worker` |               **YES**                | Multi-AZ task placement (min 2 tasks across 2 availability zones)  |
| **Application Load Balancer (ALB)**          | HTTPS ingress and host routing for `api` and `ingest`            |               **YES**                | Native TLS termination and listener routing                        |
| **Amazon RDS for PostgreSQL 16**             | Relational system of record with PostGIS Multi-AZ                |               **YES**                | PostGIS 3.4 extension fully supported; storage autoscaling enabled |
| **Amazon S3**                                | Private buckets for CSV imports, exports, and firmware           |               **YES**                | Versioning, Block Public Access enabled, SSE-KMS encryption        |
| **Amazon SES v2**                            | Transactional email dispatch                                     |               **YES**                | Native in `ap-south-1` for sending system notifications            |
| **Amazon SNS**                               | Webhook topics for SES bounces and complaints                    |               **YES**                | Connects to `POST /api/v1/webhooks/ses`                            |
| **AWS KMS**                                  | Customer-managed master keys (CMKs) for envelope encryption      |               **YES**                | Field-level encryption for DOB, guardian contact, recovery codes   |
| **AWS Secrets Manager**                      | Secure storage and 90-day rotation for API & DB tokens           |               **YES**                | Rotates DB credentials, HMAC keys, JWT signing keys                |
| **AWS Systems Manager Parameter Store**      | Non-secret system configuration defaults storage                 |               **YES**                | Holds system defaults from Part 14.4                               |
| **AWS WAF (Regional)**                       | Web application firewall on ALB ingress                          |               **YES**                | Regional Web ACL applied directly to Application Load Balancer     |
| **AWS Certificate Manager (ACM - Regional)** | TLS certificates for ALB (`api` and `ingest`)                    |               **YES**                | Regional certificate issuance and automated renewal                |
| **Amazon Route 53**                          | Managed DNS with low TTL (60s) for rapid failover                |           **YES (Global)**           | Managed DNS for `api`, `ingest`, `admin`, and `status` subdomains  |
| **Amazon CloudFront**                        | CDN distribution serving static admin console assets             |        **YES (Global Edge)**         | Edge points of presence in Mumbai, Chennai, Delhi, Bangalore       |

All required core application services in Parts 2 and 3 evaluate to **YES** in `ap-south-1`.

---

## 3. Global Edge Boundary Architecture (CloudFront ACM & WAF)

CloudFront is a global edge service. AWS architecture dictates that certain CloudFront edge resources are global and must reside in `us-east-1` (N. Virginia):

1. **CloudFront Public TLS Certificate:**
   - **Requirement:** Custom domain names configured on CloudFront distributions require an SSL/TLS certificate issued via AWS Certificate Manager.
   - **AWS Architectural Rule:** To attach an ACM certificate to a CloudFront distribution, the certificate **must be created in the `us-east-1` (US East, N. Virginia) region**. Certificates requested in regional endpoints (such as `ap-south-1`) cannot be associated with CloudFront.
2. **CloudFront WAF Web ACL:**
   - **Requirement:** Edge web application firewall filtering on static admin console asset requests.
   - **AWS Architectural Rule:** WAF Web ACLs protecting CloudFront distributions must be created with `Scope: CLOUDFRONT`, which is exclusively managed through the global endpoint residing in `us-east-1`. (The regional WAF Web ACL protecting the ALB remains in `ap-south-1`).

**Terraform Implementation:**
The root Terraform module (`infra/terraform`) maintains `ap-south-1` as the primary default provider for all infrastructure (ECS, RDS, S3, KMS, ALB). An aliased provider (`aws.us-east-1`) is configured exclusively to provision the CloudFront ACM certificate and the edge CloudFront WAF Web ACL.
