# ---------------------------------------------------------------------------
# DNS and TLS for updates.<root_domain>
#
# The hosted zone already exists and already contains records for the Amplify
# website. It is looked up, not created, and Terraform adds only the records for
# the updates subdomain. Nothing here touches the apex or www.
# ---------------------------------------------------------------------------
data "aws_route53_zone" "root" {
  name         = "${var.root_domain}."
  private_zone = false
}

# Certificate for the updates hostname.
#
# Issued in us-east-1 via the provider alias because CloudFront will not accept a
# certificate from any other region for an alternate domain name. The origins stay
# in ap-south-1; only this certificate is regional-pinned.
resource "aws_acm_certificate" "updates" {
  provider = aws.us_east_1

  domain_name       = local.updates_fqdn
  validation_method = "DNS"

  lifecycle {
    # ACM cannot change a certificate's domain in place, so a domain change means
    # a replacement. Create the new one before destroying the old, otherwise the
    # distribution briefly references a deleted certificate.
    create_before_destroy = true
  }
}

resource "aws_route53_record" "updates_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.updates.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = data.aws_route53_zone.root.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "updates" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.updates.arn
  validation_record_fqdns = [for record in aws_route53_record.updates_cert_validation : record.fqdn]
}

# Alias records pointing the updates hostname at the distribution. A and AAAA so
# clients on IPv6-only mobile networks resolve too, which is common on Indian
# carriers.
resource "aws_route53_record" "updates_a" {
  zone_id = data.aws_route53_zone.root.zone_id
  name    = local.updates_fqdn
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.updates.domain_name
    zone_id                = aws_cloudfront_distribution.updates.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "updates_aaaa" {
  zone_id = data.aws_route53_zone.root.zone_id
  name    = local.updates_fqdn
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.updates.domain_name
    zone_id                = aws_cloudfront_distribution.updates.hosted_zone_id
    evaluate_target_health = false
  }
}
