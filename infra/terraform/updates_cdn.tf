# ---------------------------------------------------------------------------
# CloudFront distribution for updates.<root_domain>
#
# Two origins behind one hostname:
#
#   /api/manifest*  -> manifest Lambda, caching disabled
#   everything else -> S3, cached hard and forever
#
# The split matters. A manifest response varies by expo-platform,
# expo-runtime-version and expo-expect-signature, and must always be fresh — the
# spec recommends `cache-control: private, max-age=0` precisely so a client never
# gets a stale answer about what the latest update is. Assets are the opposite:
# content-addressed, immutable, and safe to cache for a year.
# ---------------------------------------------------------------------------

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

# Forwards the expo-specific headers the Lambda needs to select the correct update.
#
# IMPORTANT: Must NOT forward the Authorization header. CloudFront OAC signs the
# origin request with SigV4, setting its own Authorization header. If the viewer's
# Authorization header is also forwarded (as AllViewerExceptHostHeader does), the
# Lambda function URL sees conflicting signatures and returns 403.
resource "aws_cloudfront_origin_request_policy" "manifest_headers" {
  name = "${local.name_prefix}-manifest-headers"

  headers_config {
    header_behavior = "whitelist"
    headers {
      items = [
        "expo-protocol-version",
        "expo-platform",
        "expo-runtime-version",
        "expo-expect-signature",
        "accept",
      ]
    }
  }

  cookies_config {
    cookie_behavior = "none"
  }

  query_strings_config {
    query_string_behavior = "none"
  }
}

# Origin Access Control, used for both origins so neither is reachable directly.
resource "aws_cloudfront_origin_access_control" "updates_s3" {
  name                              = "${local.name_prefix}-s3-oac"
  description                       = "Lets only the OTA distribution read the update bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# The manifest Lambda's function URL is set to AWS_IAM auth rather than NONE, so
# it cannot be called directly, bypassing the distribution. CloudFront signs each
# origin request with SigV4 through this OAC.
resource "aws_cloudfront_origin_access_control" "updates_lambda" {
  name                              = "${local.name_prefix}-lambda-oac"
  description                       = "Lets only the OTA distribution invoke the manifest function URL"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_response_headers_policy" "updates" {
  name = "${local.name_prefix}-security-headers"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = false
      preload                    = false
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }
  }
}

resource "aws_cloudfront_distribution" "updates" {
  enabled     = true
  comment     = "Dukaaon OTA updates (${var.environment})"
  price_class = var.cloudfront_price_class

  aliases = [local.updates_fqdn]

  # HTTP/2 and HTTP/3. HTTP/3 helps most on exactly the lossy mobile networks
  # these clients are on.
  http_version    = "http2and3"
  is_ipv6_enabled = true

  origin {
    origin_id                = "s3-assets"
    domain_name              = aws_s3_bucket.updates.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.updates_s3.id
  }

  origin {
    origin_id = "lambda-manifest"
    # A function URL is https://<id>.lambda-url.<region>.on.aws/ — CloudFront wants
    # the bare host, so strip the scheme and trailing slash.
    domain_name              = replace(replace(aws_lambda_function_url.manifest.function_url, "https://", ""), "/", "")
    origin_access_control_id = aws_cloudfront_origin_access_control.updates_lambda.id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default behaviour serves assets from S3.
  default_cache_behavior {
    target_origin_id       = "s3-assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.updates.id
  }

  ordered_cache_behavior {
    path_pattern           = "/api/manifest*"
    target_origin_id       = "lambda-manifest"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # Caching disabled, and all viewer headers forwarded, so the Lambda actually
    # sees expo-platform / expo-runtime-version / expo-expect-signature. If these
    # were dropped or the response cached, every client would get one runtime
    # version's answer regardless of what it asked for.
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.manifest_headers.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.updates.id
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.updates.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
