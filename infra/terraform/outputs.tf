output "expo_update_url" {
  description = <<-EOT
    Value for the EXPO_UPDATE_URL environment variable.

    This is compiled into every binary. Setting it is the single switch that turns
    OTA on: app.config.js keys `updates.enabled` off its presence. After setting
    it, run `npx expo-updates configuration:syncnative --platform android` so the
    native project picks it up.
  EOT
  value       = "https://${local.updates_fqdn}/api/manifest"
}

output "updates_hostname" {
  description = "Hostname serving both the manifest endpoint and update assets."
  value       = local.updates_fqdn
}

output "updates_bucket" {
  description = "S3 bucket holding published update bundles and assets. The publish script writes here."
  value       = aws_s3_bucket.updates.id
}

output "cloudfront_distribution_id" {
  description = "Distribution id, needed to invalidate /api/manifest* after a publish."
  value       = aws_cloudfront_distribution.updates.id
}

output "cloudfront_domain_name" {
  description = <<-EOT
    The distribution's own domain name.

    Useful for debugging DNS or certificate problems by bypassing Route 53. Do not
    use this as EXPO_UPDATE_URL — baking a CloudFront-owned hostname into shipped
    binaries would make it impossible to migrate later.
  EOT
  value       = aws_cloudfront_distribution.updates.domain_name
}

output "code_signing_secret_name" {
  description = <<-EOT
    Secrets Manager entry that must hold the PEM private key used to sign
    manifests. Terraform creates the container but never the value — writing a
    private key through Terraform would persist it in state in plaintext.
  EOT
  value       = var.code_signing_enabled ? aws_secretsmanager_secret.code_signing_private_key[0].name : null
}

output "manifest_lambda_name" {
  description = "Manifest Lambda function name, for reading logs during debugging."
  value       = aws_lambda_function.manifest.function_name
}

output "manifest_lambda_log_group" {
  description = "CloudWatch log group for the manifest Lambda."
  value       = aws_cloudwatch_log_group.manifest_lambda.name
}

output "build_secret_name" {
  description = <<-EOT
    Secrets Manager entry holding Android signing material and client config for
    CodeBuild. Terraform creates the container; you populate it.

    NOTE: both buildspec.yml and buildspec-ota.yml reference this name as a literal
    string, because a buildspec cannot interpolate Terraform output. If you change
    `environment` away from "production", update the secret ids in both buildspecs
    to match.

    Required JSON keys:
      keystore_base64                 base64 of credentials/android/dukaaon_upload_new.jks
      keystore_password
      key_password
      google_services_json_base64     base64 of google-services.json
      google_maps_api_key
      expo_public_supabase_url
      expo_public_supabase_anon_key
      expo_public_razorpay_key_id
      expo_update_url                 same value as the expo_update_url output
      firebase_api_key
      ota_bucket                      same value as the updates_bucket output
      ota_base_url                    "https://" + updates_hostname
      ota_distribution_id             same value as cloudfront_distribution_id
  EOT
  value       = aws_secretsmanager_secret.build.name
}

output "codebuild_android_project" {
  description = "CodeBuild project that produces the release AAB. Start a build with: aws codebuild start-build --project-name <this>"
  value       = aws_codebuild_project.android_release.name
}

output "codebuild_ota_project" {
  description = "CodeBuild project that publishes an OTA update. Start with: aws codebuild start-build --project-name <this> --environment-variables-override name=PUBLISH_MESSAGE,value='...'"
  value       = aws_codebuild_project.ota_publish.name
}

output "build_artifacts_bucket" {
  description = "Where release AABs land. Objects expire after 90 days; every artifact is reproducible from its commit."
  value       = aws_s3_bucket.build_artifacts.id
}
