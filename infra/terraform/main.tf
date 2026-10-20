terraform {
  required_version = ">= 1.8.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "CollegeBusTracker"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# 1. KMS CMK Key for Field-Level & Storage Encryption (Part 13.24)
resource "aws_kms_key" "main" {
  description             = "KMS Key for College Bus Tracker Data Encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

# 2. VPC & Private Subnets (Part 13.27, Part 20.11)
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = {
    Name = "collegebus-vpc-${var.environment}"
  }
}

resource "aws_subnet" "public_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"
}

resource "aws_subnet" "public_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}b"
}

resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "${var.aws_region}a"
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "${var.aws_region}b"
}

# 3. Private S3 Buckets with KMS Encryption & Block Public Access (Part 13.13)
resource "aws_s3_bucket" "exports" {
  bucket = "collegebus-exports-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "exports_bpa" {
  bucket                  = aws_s3_bucket.exports.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "exports_sse" {
  bucket = aws_s3_bucket.exports.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.main.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "exports_lifecycle" {
  bucket = aws_s3_bucket.exports.id
  rule {
    id     = "delete-after-7-days"
    status = "Enabled"
    expiration {
      days = 7
    }
  }
}

# 4. Amazon RDS PostgreSQL 16 Multi-AZ (Part 20.11)
resource "aws_db_subnet_group" "rds" {
  name       = "collegebus-rds-${var.environment}"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

resource "aws_db_instance" "postgres" {
  identifier             = "collegebus-db-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = "db.t4g.medium"
  allocated_storage      = 50
  max_allocated_storage  = 200
  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.rds.name
  kms_key_id             = aws_kms_key.main.arn
  storage_encrypted      = true
  skip_final_snapshot    = var.environment != "production"
  backup_retention_period = 7
}

# 5. Secrets Manager (Part 13.23)
resource "aws_secretsmanager_secret" "api_secrets" {
  name        = "collegebus/${var.environment}/api-credentials"
  kms_key_id  = aws_kms_key.main.arn
}
