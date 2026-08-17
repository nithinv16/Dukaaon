# OTA updates and CI on AWS

Self-hosted over-the-air updates for the Dukaaon Android app, plus Android release
builds, running on AWS instead of EAS.

## Why self-hosted

Two reasons, in order of importance:

1. **End-to-end code signing.** EAS Update gates signed updates behind its $199/mo
   Production plan. Without signing, anyone who can write to the update bucket can
   execute arbitrary JavaScript inside every installed app, with no store review in
   the path. For an app that processes Razorpay payments, that is not an acceptable
   default. Self-hosting means we hold the signing key and clients verify it.
2. **Cost and control.** The AWS account already exists for Bedrock and Textract, so
   the marginal cost is a bucket, a distribution and a small Lambda.

## What runs where

```
                        updates.dukaaon.in  (Route 53 → CloudFront)
                                    │
                ┌───────────────────┴────────────────────┐
                │                                        │
        /api/manifest*                            everything else
                │                                        │
        Lambda (ap-south-1)                      S3 (ap-south-1)
        reads latest.json,                       assets/<sha256>
        signs the response                       immutable, cached 1 year
                │
        Secrets Manager
        code signing private key
```

Both origins sit behind Origin Access Control, so neither is reachable directly.
The Lambda's function URL uses `AWS_IAM` auth rather than `NONE`, so it cannot be
called around CloudFront.

### Why the certificate is in git but the private key is not

`expo-updates` inlines the certificate's PEM **contents** into
`AndroidManifest.xml` at build time, so it ships inside the APK regardless.
Committing it is what makes builds reproducible and keeps every binary trusting the
same root. The private key lives only in Secrets Manager and is read only by the
manifest Lambda — not by CI, and not by developer machines.

That split is deliberate: the publish pipeline **cannot sign**. Compromising the
publish role lets an attacker upload bytes, but not produce an update any client
will accept.

## One-time setup

### 1. Apply the infrastructure

```bash
cd infra/terraform
terraform init
terraform validate
terraform plan      # read this carefully the first time
terraform apply
```

The Route 53 hosted zone for `dukaaon.in` is **looked up, not created**. Terraform
adds only records for the `updates` subdomain, so the Amplify website records are
untouched.

Note the ACM certificate is issued in `us-east-1` even though everything else is in
`ap-south-1`. That is a hard CloudFront requirement, not an oversight.

Terraform state is local on first apply, because a configuration cannot bootstrap
its own backend. Move it to S3 before a second person can apply — concurrent
applies with no lock will corrupt state.

### 2. Upload the code signing private key

Generated once, already done, valid 10 years (to 2036-08-15):

```bash
aws secretsmanager put-secret-value \
  --secret-id "$(terraform -chdir=infra/terraform output -raw code_signing_secret_name)" \
  --secret-string "file://certs/code-signing/private-key.pem"
```

Rotating this key requires shipping a new binary, because the certificate is
embedded in the app. Treat it as long-lived.

### 3. Populate the build secret

```bash
cd infra/terraform
cat > /tmp/build-secret.json <<JSON
{
  "keystore_base64": "$(base64 -i ../../credentials/android/dukaaon_upload_new.jks)",
  "keystore_password": "REPLACE",
  "key_password": "REPLACE",
  "google_services_json_base64": "$(base64 -i ../../google-services.json)",
  "google_maps_api_key": "REPLACE",
  "expo_public_supabase_url": "REPLACE",
  "expo_public_supabase_anon_key": "REPLACE",
  "expo_public_razorpay_key_id": "REPLACE",
  "firebase_api_key": "REPLACE",
  "expo_update_url": "$(terraform output -raw expo_update_url)",
  "ota_bucket": "$(terraform output -raw updates_bucket)",
  "ota_base_url": "https://$(terraform output -raw updates_hostname)",
  "ota_distribution_id": "$(terraform output -raw cloudfront_distribution_id)"
}
JSON

aws secretsmanager put-secret-value \
  --secret-id "$(terraform output -raw build_secret_name)" \
  --secret-string "file:///tmp/build-secret.json"

rm /tmp/build-secret.json
```

**Change the keystore password first.** The old value is in git history. Use
`keytool -storepasswd` and `keytool -keypasswd`, which change the password without
changing the keypair — so the signing identity is preserved and Play still accepts
the artifact. This is not a key rotation.

### 4. Restore AWS access for the edge functions

`ai-chat`, `ai-ocr` and `ai-translate` are currently returning 503 because the old
access key was deleted. Terraform creates a scoped IAM user for them; the key is
created out-of-band so it never enters Terraform state.

```bash
USER=$(terraform -chdir=infra/terraform output -raw edge_function_iam_user)
REGION=$(terraform -chdir=infra/terraform output -raw edge_function_ai_region)

aws iam create-access-key --user-name "$USER"
# then, with the values it prints:
supabase secrets set \
  AWS_ACCESS_KEY_ID=... \
  AWS_SECRET_ACCESS_KEY=... \
  AWS_REGION="$REGION"
```

The policy grants exactly four actions: `bedrock:InvokeModel` (restricted to the two
Claude model ARNs actually used), `textract:DetectDocumentText`,
`translate:TranslateText` and `comprehend:DetectDominantLanguage`. No S3, no
asynchronous Textract, no batch translation.

**Why a static key rather than a role.** Supabase edge functions run on Deno Deploy,
so there is no instance identity or OIDC token to exchange for temporary
credentials. The alternative is an AWS-side proxy holding a role, which the edge
function authenticates to with a shared secret — but that shared secret and this
scoped key have nearly the same blast radius (spend money on inference; no data
access), so the proxy buys a network hop and a second secret for very little. What
makes this safe is the narrow scope, not the credential type. If these functions
ever need S3 or anything touching customer data, revisit that reasoning.

**Rotate on a schedule, not after an incident.** IAM allows two keys per user, so
rotation is zero-downtime:

```bash
aws iam create-access-key --user-name "$USER"   # 1. new key
supabase secrets set AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
# 2. verify ai-chat / ai-ocr / ai-translate respond
aws iam delete-access-key --user-name "$USER" --access-key-id <old>   # 3. remove old
```

Step 3 is the one that gets skipped. A user with two live keys and no memory of what
the second is for is how these leak quietly.

Note the AI region (`us-east-1`) is deliberately different from the OTA region
(`ap-south-1`): Bedrock foundation-model availability is uneven by region, and these
models are available in `us-east-1`.

### 5. Authorise CodeBuild to read the repository

A GitHub connection is an account-level, one-time authorisation and is not managed
by Terraform:

```bash
aws codebuild import-source-credentials \
  --server-type GITHUB --auth-type PERSONAL_ACCESS_TOKEN --token <token>
```

### 6. Turn OTA on

Until `EXPO_UPDATE_URL` is set, `app.config.js` keeps updates disabled and builds
behave exactly as before. Setting it is the only switch.

```bash
export EXPO_UPDATE_URL="$(terraform -chdir=infra/terraform output -raw expo_update_url)"
node node_modules/expo-updates/bin/cli.js configuration:syncnative --platform android
git diff android/app/src/main/AndroidManifest.xml android/app/src/main/res/values/strings.xml
```

Then build and ship that binary through Play. **Updates only reach binaries built
after this point**, because only those report a runtime version the server knows
about.

## Day-to-day

### Ship a JS-only change

```bash
export OTA_BUCKET=$(terraform -chdir=infra/terraform output -raw updates_bucket)
export OTA_BASE_URL="https://$(terraform -chdir=infra/terraform output -raw updates_hostname)"
export OTA_DISTRIBUTION_ID=$(terraform -chdir=infra/terraform output -raw cloudfront_distribution_id)
export EXPO_UPDATE_URL=$(terraform -chdir=infra/terraform output -raw expo_update_url)

npm run ota:publish -- --message "fix cart total rounding"
```

Or in CI:

```bash
aws codebuild start-build \
  --project-name "$(terraform -chdir=infra/terraform output -raw codebuild_ota_project)" \
  --environment-variables-override name=PUBLISH_MESSAGE,value="fix cart total rounding"
```

### Ship a native change

Anything that touches dependencies, permissions, SDK versions or `android/`
requires a store release. Bump `versionCode` in `app.config.js`, then:

```bash
aws codebuild start-build \
  --project-name "$(terraform -chdir=infra/terraform output -raw codebuild_android_project)"
```

### Roll back a bad update

```bash
npm run ota:rollback          # clients discard updates, run the embedded bundle
npm run ota:clear-rollback    # resume serving updates
```

Rollback takes effect on the next update check after the CloudFront invalidation
lands. To go back to a *specific* earlier update instead of the embedded bundle,
copy its archived manifest over `latest.json`:

```bash
aws s3 cp \
  "s3://$OTA_BUCKET/runtime/android/<runtimeVersion>/<updateId>/manifest.json" \
  "s3://$OTA_BUCKET/runtime/android/<runtimeVersion>/latest.json"
```

### Check what clients are being served

```bash
curl -sD - -o /dev/null "$EXPO_UPDATE_URL" \
  -H 'expo-protocol-version: 1' \
  -H 'expo-platform: android' \
  -H 'accept: application/expo+json' \
  -H "expo-runtime-version: $(node node_modules/expo-updates/bin/cli.js runtimeversion:resolve --platform android | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s.match(/\{[\s\S]*\}$/)[0]).runtimeVersion))")"
```

A `204` means no update is published for that runtime version, which is the normal
state for a freshly released binary.

## The runtime version is the safety mechanism

The runtime version is a **fingerprint** of the native layer, so an update can only
ever be served to a binary whose native code matches. That is what makes OTA safe
here rather than a way to brick installs.

The corollary catches people out: several innocuous-looking files are fingerprint
inputs, and editing any of them changes the runtime version and therefore cuts
compatibility with already-shipped binaries.

Confirmed inputs include:

- `eas.json`
- `.gitignore`
- `google-services.json`
- `app.plugin.js`, `app.config.js`
- every config plugin under `node_modules`
- the autolinking result for all native modules

This was observed, not theorised: editing `.gitignore` and `eas.json` during this
work moved the runtime version from `ce4bb586…` to `9a434a65…`.

Check before publishing:

```bash
node node_modules/expo-updates/bin/cli.js runtimeversion:resolve --platform android
```

If it does not match what your installed binaries report, the update will reach
nobody — silently, with no error on either side.

`google-services.json` deserves specific care: it is gitignored, so CI decodes it
from Secrets Manager. If that copy ever differs by even a byte from the one used
elsewhere, computed runtime versions diverge.

## Tests

```bash
npm run test:ota    # 35 tests: protocol helpers + manifest construction
```

These cover the parts that fail confusingly in production: SFV header parsing,
content negotiation and 406/400/204 status selection, multipart byte layout,
signature-over-transmitted-bytes, and the three distinct digests each asset needs
(`sha256` hex for the S3 key, `sha256` base64url for the client's `hash`, `md5` hex
for the bundle's `key`).

`npm run verify` runs the typecheck gate, then these, then Jest. It currently exits
non-zero because of 9 pre-existing failing Jest suites — see
`VERIFICATION_BASELINE.md`. The OTA tests are ordered before Jest so they actually
gate rather than being skipped by the earlier failure.

## Known gaps

- The Terraform in this directory has **never been applied or validated**. Run
  `terraform validate` and read the first `plan` carefully.
- CloudFront OAC in front of an `AWS_IAM` Lambda function URL is configured but
  unverified end to end.
- iOS is not set up. There is no `ios/` directory and the buildspec is
  Android-only. iOS would need macOS build capacity, and EC2 Mac Dedicated Hosts
  bill with a 24-hour minimum allocation, which is the main reason iOS self-hosting
  is expensive.
- The buildspecs hardcode the secret id `dukaaon-ota-production/build`, because a
  buildspec cannot read Terraform output. Changing `environment` means editing both
  buildspecs.
