terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "linatrixsite-terraform-state-2026"
    key            = "eks/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "linatrixsite-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "eu-north-1"
}
