terraform {
  required_version = ">= 1.8.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60.0"
    }
  }

  backend "s3" {
    bucket         = "collegebus-terraform-state-dev"
    key            = "dev/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "collegebus-terraform-locks-dev"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

module "collegebus" {
  source = "../../"

  environment = "dev"
  aws_region  = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "ap-south-1"
}
