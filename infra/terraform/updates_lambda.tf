# ---------------------------------------------------------------------------
# Manifest Lambda
#
# Implements the server half of the Expo Updates v1 protocol:
# https://docs.expo.dev/technical-specs/expo-updates-1/
#
# It does very little work. For a given expo-platform + expo-runtime-version it
# reads one small JSON index from S3 and returns the manifest, optionally signed.
# All the heavy lifting (bundling, hashing, uploading) happens in the publish
# script, not here.
# ---------------------------------------------------------------------------

data "archive_file" "manifest_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/manifest"
  output_path = "${path.module}/.build/manifest-lambda.zip"
}

# Private key used to sign manifests.
#
# Terraform creates the container but never the value — the key is generated
# locally with `npx expo-updates codesigning:generate` and pushed in out-of-band.
# Putting a private key in Terraform would write it to state in plaintext, which
# defeats the point of having it.
resource "aws_secretsmanager_secret" "code_signing_private_key" {
  count = var.code_signing_enabled ? 1 : 0

  name        = "${local.name_prefix}/code-signing-private-key"
  description = "PEM private key used to sign OTA update manifests. Populated out-of-band; never stored in Terraform state."

  recovery_window_in_days = 7
}

data "aws_iam_policy_document" "manifest_lambda_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "manifest_lambda" {
  name               = "${local.name_prefix}-manifest-lambda"
  assume_role_policy = data.aws_iam_policy_document.manifest_lambda_assume.json
}

data "aws_iam_policy_document" "manifest_lambda" {
  # Read the runtime index and manifests. Deliberately read-only: the function that
  # serves updates has no business publishing them.
  statement {
    sid       = "ReadUpdateIndex"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.updates.arn}/runtime/*"]
  }

  statement {
    sid       = "ListUpdateIndex"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.updates.arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["runtime/*"]
    }
  }

  dynamic "statement" {
    for_each = var.code_signing_enabled ? [1] : []

    content {
      sid       = "ReadCodeSigningKey"
      effect    = "Allow"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = [aws_secretsmanager_secret.code_signing_private_key[0].arn]
    }
  }
}

resource "aws_iam_role_policy" "manifest_lambda" {
  name   = "manifest-lambda"
  role   = aws_iam_role.manifest_lambda.id
  policy = data.aws_iam_policy_document.manifest_lambda.json
}

resource "aws_iam_role_policy_attachment" "manifest_lambda_logs" {
  role       = aws_iam_role.manifest_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "manifest_lambda" {
  name              = "/aws/lambda/${local.name_prefix}-manifest"
  retention_in_days = 30
}

resource "aws_lambda_function" "manifest" {
  function_name = "${local.name_prefix}-manifest"
  role          = aws_iam_role.manifest_lambda.arn

  runtime = "nodejs20.x"
  handler = "index.handler"

  filename         = data.archive_file.manifest_lambda.output_path
  source_code_hash = data.archive_file.manifest_lambda.output_base64sha256

  memory_size = var.manifest_lambda_memory_mb
  timeout     = var.manifest_lambda_timeout_seconds

  environment {
    variables = {
      UPDATES_BUCKET       = aws_s3_bucket.updates.id
      ASSET_BASE_URL       = "https://${local.updates_fqdn}"
      CODE_SIGNING_ENABLED = tostring(var.code_signing_enabled)
      CODE_SIGNING_SECRET  = var.code_signing_enabled ? aws_secretsmanager_secret.code_signing_private_key[0].name : ""
      # Must match the keyid embedded in the app's certificate metadata. The
      # client uses it to pick which certificate verifies the signature.
      CODE_SIGNING_KEY_ID = "main"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.manifest_lambda_logs,
    aws_cloudwatch_log_group.manifest_lambda,
  ]
}

# AWS_IAM rather than NONE. Combined with the CloudFront OAC above, this means the
# only caller that can reach the function is the distribution — the function URL
# cannot be hit directly to bypass TLS, headers or WAF.
resource "aws_lambda_function_url" "manifest" {
  function_name      = aws_lambda_function.manifest.function_name
  authorization_type = "AWS_IAM"
}

# Permit exactly this distribution to invoke the function URL.
# AWS docs require BOTH lambda:InvokeFunctionUrl AND lambda:InvokeFunction
# for CloudFront OAC to work with Lambda function URLs.
# https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html
resource "aws_lambda_permission" "manifest_cloudfront" {
  statement_id  = "AllowCloudFrontOAC"
  action        = "lambda:InvokeFunctionUrl"
  function_name = aws_lambda_function.manifest.function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = aws_cloudfront_distribution.updates.arn
}

resource "aws_lambda_permission" "manifest_cloudfront_invoke" {
  statement_id  = "AllowCloudFrontOACInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.manifest.function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = aws_cloudfront_distribution.updates.arn
}
