variable "aws_region" {
  type        = string
  description = "AWS region for resources (ap-south-1)"
  default     = "ap-south-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, production)"
  default     = "dev"
}
