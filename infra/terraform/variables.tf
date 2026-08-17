variable "aws_region" {
  description = "Primary region for the update bucket, manifest Lambda and CodeBuild."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment. Also used to namespace resource names, so a staging stack can coexist with production in one account."
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "environment must be one of: production, staging."
  }
}

variable "root_domain" {
  description = <<-EOT
    The existing Route 53 hosted zone apex, without a trailing dot.

    This zone is looked up, never created. The website already lives here on
    Amplify, so Terraform must not manage the zone itself — it only adds records
    for the updates subdomain.
  EOT
  type        = string
  default     = "dukaaon.in"
}

variable "updates_subdomain" {
  description = <<-EOT
    Hostname that serves the update manifest and assets.

    This value is compiled into every binary via EXPO_UPDATE_URL, so treat it as
    permanent. Owning the hostname (rather than using the CloudFront domain) is
    what makes it possible to move to different infrastructure later without
    stranding already-installed apps.
  EOT
  type        = string
  default     = "updates"
}

variable "cloudfront_price_class" {
  description = <<-EOT
    CloudFront price class.

    PriceClass_200 includes India, which PriceClass_100 does not. Given the user
    base, PriceClass_100 would serve Indian users from outside the region and add
    latency to every update check.
  EOT
  type        = string
  default     = "PriceClass_200"

  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.cloudfront_price_class)
    error_message = "cloudfront_price_class must be PriceClass_All, PriceClass_200 or PriceClass_100."
  }
}

variable "manifest_lambda_memory_mb" {
  description = "Memory for the manifest Lambda. It only reads a small JSON index from S3 and signs a payload, so this is about CPU allocation (which scales with memory) rather than working set."
  type        = number
  default     = 512
}

variable "manifest_lambda_timeout_seconds" {
  description = "Timeout for the manifest Lambda. Update checks happen on app launch, so a slow response delays nothing but should still fail fast rather than hang."
  type        = number
  default     = 10
}

variable "asset_retention_days" {
  description = <<-EOT
    How long to keep old update assets before expiring them.

    Careful: the protocol requires that an asset at a given URL never changes or
    disappears, because a client may fetch assets for any update it has a manifest
    for at any time. Expiring assets that a still-installed binary might request
    will break that install. Keep this generously longer than your slowest-updating
    users, and set to 0 to disable expiry entirely.
  EOT
  type        = number
  default     = 365
}

variable "code_signing_enabled" {
  description = <<-EOT
    Whether the manifest Lambda signs responses.

    This is the reason for self-hosting rather than using EAS Update, which gates
    end-to-end code signing behind its $199/mo plan. Without signing, anyone who
    can write to the bucket or the Lambda can push arbitrary JavaScript to every
    installed app, with no store review in the way.

    Requires the private key to already exist in Secrets Manager and the
    certificate to be embedded in the app. See infra/terraform/README.md.
  EOT
  type        = bool
  default     = true
}

variable "github_repository_url" {
  description = <<-EOT
    HTTPS clone URL of the source repository, used by both CodeBuild projects.

    CodeBuild needs a GitHub connection to read a private repository. That is an
    account-level, one-time authorisation and is not managed here — see
    infra/README.md. Terraform can create the projects before the connection
    exists, but builds will fail to fetch source until it does.
  EOT
  type        = string
  default     = "https://github.com/nithinv16/Dukaaon.git"
}

variable "build_branch" {
  description = <<-EOT
    Branch or ref that CodeBuild builds by default.

    Deliberately not `main` by default for this project, because the work is
    currently happening on a feature branch. Override per build rather than
    changing this, so the default stays predictable.
  EOT
  type        = string
  default     = "main"
}
