# ---------------------------------------------------------------------------
# CodeBuild: Android release builds and OTA publishing
#
# Two projects rather than one, because the jobs have very different shapes:
#
#   android-release  JDK + Android SDK + Gradle, tens of minutes, produces an AAB
#   ota-publish      Node only, a few minutes, changes what runs on live devices
#
# Splitting them means an OTA publish is never queued behind a native build, and
# each role gets only the permissions its job needs. In particular the publish role
# can write to the update bucket, and the build role cannot.
# ---------------------------------------------------------------------------

# Build inputs: keystore, google-services.json, client config, OTA coordinates.
#
# Terraform creates the container only. Contents are written out-of-band, because a
# secret set through Terraform is stored in state in plaintext, which would defeat
# the purpose for the keystore password in particular.
resource "aws_secretsmanager_secret" "build" {
  name        = "${local.name_prefix}/build"
  description = "Android signing material and client configuration for CodeBuild. Populated out-of-band; see infra/README.md for the required JSON keys."

  recovery_window_in_days = 7
}

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

# --- Android release build --------------------------------------------------

resource "aws_iam_role" "codebuild_android" {
  name               = "${local.name_prefix}-codebuild-android"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

data "aws_iam_policy_document" "codebuild_android" {
  statement {
    sid    = "Logs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/codebuild/${local.name_prefix}-*"]
  }

  statement {
    sid       = "ReadBuildSecret"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.build.arn]
  }

  # Note there is deliberately no s3:PutObject on the update bucket here. A native
  # build produces an artifact for the Play Console; it has no reason to be able to
  # push JavaScript to live devices, and separating the two means a compromise of
  # this role cannot do so.
  statement {
    sid    = "ArtifactBucket"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:GetBucketLocation",
    ]
    resources = ["${aws_s3_bucket.build_artifacts.arn}/*"]
  }
}

resource "aws_iam_role_policy" "codebuild_android" {
  name   = "codebuild-android"
  role   = aws_iam_role.codebuild_android.id
  policy = data.aws_iam_policy_document.codebuild_android.json
}

resource "aws_s3_bucket" "build_artifacts" {
  bucket = "${local.name_prefix}-build-artifacts"
}

resource "aws_s3_bucket_public_access_block" "build_artifacts" {
  bucket                  = aws_s3_bucket.build_artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "build_artifacts" {
  bucket = aws_s3_bucket.build_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "build_artifacts" {
  bucket = aws_s3_bucket.build_artifacts.id

  # AABs are large and every one is reproducible from a commit, so there is no
  # reason to keep them indefinitely.
  rule {
    id     = "expire-old-artifacts"
    status = "Enabled"
    filter {}

    expiration {
      days = 90
    }
  }
}

resource "aws_cloudwatch_log_group" "codebuild_android" {
  name              = "/aws/codebuild/${local.name_prefix}-android-release"
  retention_in_days = 90
}

resource "aws_codebuild_project" "android_release" {
  name          = "${local.name_prefix}-android-release"
  description   = "Android release AAB. Builds from the committed android/ directory; does not run expo prebuild."
  service_role  = aws_iam_role.codebuild_android.arn
  build_timeout = 90 # minutes. Local Gradle build is ~14 min; CI hardware is slower and this has ProGuard plus per-ABI splits.

  artifacts {
    type      = "S3"
    location  = aws_s3_bucket.build_artifacts.bucket
    packaging = "ZIP"
    path      = "android-release"
  }

  cache {
    type  = "LOCAL"
    # Gradle dependency caching dominates cold-build time. DOCKER_LAYER_CACHE is
    # omitted deliberately: it requires privileged mode, which this build does not
    # otherwise need.
    modes = ["LOCAL_CUSTOM_CACHE", "LOCAL_SOURCE_CACHE"]
  }

  environment {
    # Large: this Gradle build asks for an 8 GB heap in gradle.properties, which a
    # smaller instance cannot satisfy.
    compute_type = "BUILD_GENERAL1_LARGE"
    image        = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type         = "LINUX_CONTAINER"

    environment_variable {
      name  = "NODE_OPTIONS"
      value = "--max-old-space-size=8192"
    }
  }

  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.codebuild_android.name
    }
  }

  source {
    type      = "GITHUB"
    location  = var.github_repository_url
    buildspec = "buildspec.yml"

    git_clone_depth = 1
  }

  source_version = var.build_branch
}

# --- OTA publish ------------------------------------------------------------

resource "aws_iam_role" "codebuild_ota" {
  name               = "${local.name_prefix}-codebuild-ota"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

data "aws_iam_policy_document" "codebuild_ota" {
  statement {
    sid    = "Logs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/codebuild/${local.name_prefix}-*"]
  }

  statement {
    sid       = "ReadBuildSecret"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.build.arn]
  }

  # Write access to the update bucket. This is the permission that lets this role
  # change what runs on user devices, which is why it is scoped to the two prefixes
  # the publish script actually writes and granted to nothing else.
  statement {
    sid    = "PublishUpdates"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
    ]
    resources = [
      "${aws_s3_bucket.updates.arn}/assets/*",
      "${aws_s3_bucket.updates.arn}/runtime/*",
    ]
  }

  statement {
    sid       = "HeadObjectsForDedupe"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.updates.arn]
  }

  statement {
    sid       = "InvalidateManifestPath"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.updates.arn]
  }

  # Explicitly NOT granted: secretsmanager access to the code signing private key.
  # Signing happens in the manifest Lambda, so even a full compromise of this role
  # cannot produce an update that clients will accept.
}

resource "aws_iam_role_policy" "codebuild_ota" {
  name   = "codebuild-ota"
  role   = aws_iam_role.codebuild_ota.id
  policy = data.aws_iam_policy_document.codebuild_ota.json
}

resource "aws_cloudwatch_log_group" "codebuild_ota" {
  name              = "/aws/codebuild/${local.name_prefix}-ota-publish"
  retention_in_days = 90
}

resource "aws_codebuild_project" "ota_publish" {
  name          = "${local.name_prefix}-ota-publish"
  description   = "Publish an over-the-air JS update. Cannot sign: signing happens in the manifest Lambda."
  service_role  = aws_iam_role.codebuild_ota.arn
  build_timeout = 30

  artifacts {
    type = "NO_ARTIFACTS"
  }

  cache {
    type  = "LOCAL"
    modes = ["LOCAL_CUSTOM_CACHE", "LOCAL_SOURCE_CACHE"]
  }

  environment {
    # Metro bundling is memory-hungry but this needs far less than the native build.
    compute_type = "BUILD_GENERAL1_MEDIUM"
    image        = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type         = "LINUX_CONTAINER"

    environment_variable {
      name  = "NODE_OPTIONS"
      value = "--max-old-space-size=4096"
    }

    # Overridable per build so a publish can carry a human-readable note.
    environment_variable {
      name  = "PUBLISH_MESSAGE"
      value = ""
    }
  }

  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.codebuild_ota.name
    }
  }

  source {
    type            = "GITHUB"
    location        = var.github_repository_url
    buildspec       = "buildspec-ota.yml"
    git_clone_depth = 1
  }

  source_version = var.build_branch
}

data "aws_caller_identity" "current" {}
