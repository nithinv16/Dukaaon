terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # Remote state is deliberately not configured here.
  #
  # The first `terraform apply` has nowhere to store state yet, so bootstrapping a
  # backend in the same configuration it manages is circular. Run once with local
  # state, then move it — see infra/terraform/README.md. Local state is acceptable
  # for a single operator but should not stay that way once more than one person
  # can apply, because concurrent applies with no lock will corrupt the state.
}

# Primary region. Holds the update bucket, the manifest Lambda, Secrets Manager
# entries and CodeBuild. ap-south-1 (Mumbai) is closest to the user base.
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "dukaaon"
      Component   = "ota-updates"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}

# CloudFront requires that any ACM certificate used for an alternate domain name
# live in us-east-1, no matter where the origins are. This alias exists solely to
# issue that certificate.
# https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "dukaaon"
      Component   = "ota-updates"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}
