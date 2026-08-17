locals {
  updates_fqdn = "${var.updates_subdomain}.${var.root_domain}"
  name_prefix  = "dukaaon-ota-${var.environment}"
}

# ---------------------------------------------------------------------------
# Update bucket
#
# Holds published update bundles and assets, plus one small JSON index per
# runtime version that the manifest Lambda reads to answer a check.
#
# Layout:
#   runtime/<runtimeVersion>/latest.json          <- index the Lambda reads
#   runtime/<runtimeVersion>/<updateId>/manifest.json
#   assets/<sha256>                               <- content-addressed, immutable
#
# Assets are content-addressed on purpose. The protocol requires that an asset at
# a given URL never change, and hashing the content makes that structurally true
# instead of a rule someone has to remember.
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "updates" {
  bucket = "${local.name_prefix}-artifacts"
}

resource "aws_s3_bucket_public_access_block" "updates" {
  bucket = aws_s3_bucket.updates.id

  # The bucket is reached only through CloudFront, via Origin Access Control.
  # Nothing here should ever be publicly readable directly.
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "updates" {
  bucket = aws_s3_bucket.updates.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "updates" {
  bucket = aws_s3_bucket.updates.id

  # Versioning is a safety net against an accidental overwrite of a published
  # asset, which would otherwise silently break every client holding a manifest
  # that references it.
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "updates" {
  bucket = aws_s3_bucket.updates.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "updates" {
  count  = var.asset_retention_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.updates.id

  # Expire *noncurrent* versions only. Current objects are never expired, because
  # deleting a live asset breaks any installed app whose manifest references it.
  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.asset_retention_days
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.updates]
}

# Only this distribution may read the bucket.
data "aws_iam_policy_document" "updates_bucket" {
  statement {
    sid    = "AllowCloudFrontOriginAccessControl"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.updates.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.updates.arn]
    }
  }

  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.updates.arn,
      "${aws_s3_bucket.updates.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "updates" {
  bucket = aws_s3_bucket.updates.id
  policy = data.aws_iam_policy_document.updates_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.updates]
}
