# ---------------------------------------------------------------------------
# AWS access for the Supabase edge functions
#
# ai-chat, ai-ocr and ai-translate reach AWS through supabase/functions/_shared/aws.ts,
# which signs requests with aws4fetch using credentials held as Supabase function
# secrets. The previous access key was deleted, so those three functions are
# currently returning 503 ("AWS credentials are not configured").
#
# Why an IAM user and not a role
#
# Supabase edge functions run on Deno Deploy, not on AWS, so there is no instance
# identity, no IMDS and no OIDC token to exchange for temporary credentials. The
# options are therefore a long-lived IAM user key, or a proxy on AWS that holds a
# role and that the edge function authenticates to with a shared secret.
#
# The proxy is not worth it here. The functions are already authenticated with a
# verified Supabase JWT and rate limited before they ever reach AWS, and the policy
# below grants exactly four actions against two named model ARNs. A leaked shared
# secret for a proxy and a leaked key for this user have almost the same blast
# radius — spend money on inference, nothing more, no data access either way — so
# the proxy would add a network hop, a function URL and a second secret to manage
# for a marginal gain.
#
# What makes this safe is the scope, not the credential type. Keep it that way: if
# these functions ever need S3, DynamoDB or anything that reads customer data,
# revisit this decision, because then the blast radii stop being comparable.
# ---------------------------------------------------------------------------

variable "ai_region" {
  description = <<-EOT
    Region for Bedrock, Textract, Translate and Comprehend.

    Deliberately separate from var.aws_region. The OTA infrastructure lives in
    ap-south-1 to be close to users, but Bedrock foundation-model availability is
    uneven by region and these models are available in us-east-1. Moving this
    without checking model availability will break ai-chat.
  EOT
  type        = string
  default     = "us-east-1"
}

variable "bedrock_model_ids" {
  description = <<-EOT
    Exact Bedrock model ids the edge functions may invoke.

    Scoped to specific models rather than "*" so a leaked credential cannot be used
    to invoke arbitrarily expensive models. Read out of the function source:
    ai-chat uses claude-3-5-haiku for cheap classification and claude-sonnet-4-5
    for the main conversational path. Adding a model in code means adding it here.
  EOT
  type        = list(string)
  default = [
    "anthropic.claude-3-5-haiku-20241022-v1:0",
    "anthropic.claude-sonnet-4-5-20250929-v1:0",
  ]
}

resource "aws_iam_user" "edge_functions" {
  name = "${local.name_prefix}-edge-functions"

  tags = {
    Purpose = "Supabase edge function access to Bedrock/Textract/Translate/Comprehend"
  }
}

data "aws_iam_policy_document" "edge_functions" {
  # Bedrock, restricted to named foundation models.
  #
  # Both an inference-profile ARN and a plain foundation-model ARN are included
  # because Anthropic models on Bedrock are increasingly only reachable through a
  # cross-region inference profile, and which form applies depends on the model.
  # Granting both avoids a confusing AccessDenied that looks like a policy typo.
  statement {
    sid     = "InvokeNamedBedrockModels"
    effect  = "Allow"
    actions = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]

    resources = concat(
      [for id in var.bedrock_model_ids : "arn:aws:bedrock:${var.ai_region}::foundation-model/${id}"],
      [for id in var.bedrock_model_ids : "arn:aws:bedrock:${var.ai_region}:${data.aws_caller_identity.current.account_id}:inference-profile/*${id}"],
    )
  }

  # Textract: synchronous single-page detection only.
  #
  # Deliberately excludes the Start*/Get* asynchronous actions and anything
  # involving S3, because the OCR function posts image bytes inline and never needs
  # to read a bucket.
  statement {
    sid       = "DetectDocumentTextOnly"
    effect    = "Allow"
    actions   = ["textract:DetectDocumentText"]
    resources = ["*"] # Textract has no resource-level permissions for this action.
  }

  # Translate and Comprehend, the two actions ai-translate actually calls.
  # Notably excludes translate:TranslateDocument and the custom-terminology and
  # batch actions.
  statement {
    sid    = "TranslateAndDetectLanguage"
    effect = "Allow"
    actions = [
      "translate:TranslateText",
      "comprehend:DetectDominantLanguage",
    ]
    resources = ["*"] # Neither action supports resource-level permissions.
  }
}

resource "aws_iam_user_policy" "edge_functions" {
  name   = "edge-function-ai-access"
  user   = aws_iam_user.edge_functions.name
  policy = data.aws_iam_policy_document.edge_functions.json
}

# No aws_iam_access_key resource here, on purpose.
#
# Terraform would store the secret access key in state in plaintext, which for a
# credential whose entire security model is "do not leak it" is self-defeating.
# Create it with the CLI instead and put it straight into Supabase function secrets:
#
#   aws iam create-access-key --user-name <this user>
#   supabase secrets set AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=us-east-1
#
# Rotation, which should be routine rather than incident-driven:
#   1. aws iam create-access-key --user-name <user>      (IAM allows two at once)
#   2. supabase secrets set with the new pair
#   3. confirm ai-chat / ai-ocr / ai-translate respond
#   4. aws iam delete-access-key --access-key-id <old>
#
# Step 4 is the one people skip. An IAM user with two active keys where nobody
# remembers what the second one is for is how these leak quietly.

output "edge_function_iam_user" {
  description = "IAM user whose access key belongs in Supabase function secrets. Create the key with the CLI; it is deliberately not managed by Terraform."
  value       = aws_iam_user.edge_functions.name
}

output "edge_function_ai_region" {
  description = "Region the edge functions must be configured with (AWS_REGION secret). Separate from the OTA region because of Bedrock model availability."
  value       = var.ai_region
}
