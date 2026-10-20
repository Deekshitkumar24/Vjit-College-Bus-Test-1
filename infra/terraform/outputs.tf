output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "kms_key_arn" {
  description = "The ARN of the KMS CMK key"
  value       = aws_kms_key.main.arn
}

output "rds_endpoint" {
  description = "PostgreSQL RDS connection endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "exports_bucket_name" {
  description = "S3 bucket for exports"
  value       = aws_s3_bucket.exports.bucket
}
