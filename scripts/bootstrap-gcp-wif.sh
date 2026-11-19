#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# JavaDrill GCP Workload Identity Federation (WIF) & Deployer Bootstrap
#
# Idempotently provisions:
# 1. Required Google Cloud APIs.
# 2. Workload Identity Pool for GitHub Actions.
# 3. OIDC Provider mapped and restricted strictly to your GitHub repository.
# 4. Deployer Service Account (github-actions-deployer) with minimal required
#    Terraform & deployment IAM roles.
# 5. Workload Identity User binding on the deployer service account.
#
# Arguments:
#   $1 - PROJECT_ID   (optional, fallback to $GCP_PROJECT_ID or gcloud active project)
#   $2 - GITHUB_OWNER (optional, fallback to $GITHUB_OWNER or interactive prompt)
#   $3 - GITHUB_REPO  (optional, fallback to $GITHUB_REPO or "drill-with-me")
#   $4 - REGION       (optional, fallback to $GCP_REGION or "us-central1")
# ==============================================================================

echo "=============================================================================="
echo "  JavaDrill - GCP Workload Identity Federation (WIF) Setup"
echo "=============================================================================="

# 1. Resolve GCP Project ID
PROJECT_ID="${1:-${GCP_PROJECT_ID:-}}"
if [[ -z "${PROJECT_ID}" ]]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
fi

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  if [[ -t 0 ]]; then
    read -rp "Enter GCP Project ID: " PROJECT_ID
  fi
fi

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "[-] ERROR: GCP Project ID is required." >&2
  echo "    Usage: $0 <PROJECT_ID> <GITHUB_OWNER> [GITHUB_REPO] [REGION]" >&2
  exit 1
fi

# 2. Resolve GitHub Owner / Organization
GITHUB_OWNER="${2:-${GITHUB_OWNER:-}}"
if [[ -z "${GITHUB_OWNER}" ]]; then
  if [[ -t 0 ]]; then
    read -rp "Enter GitHub Owner / Organization (e.g. octocat): " GITHUB_OWNER
  fi
fi

if [[ -z "${GITHUB_OWNER}" ]]; then
  echo "[-] ERROR: GITHUB_OWNER is required." >&2
  echo "    Usage: $0 <PROJECT_ID> <GITHUB_OWNER> [GITHUB_REPO] [REGION]" >&2
  exit 1
fi

# 3. Resolve GitHub Repository Name & Default Region
GITHUB_REPO="${3:-${GITHUB_REPO:-drill-with-me}}"
REGION="${4:-${GCP_REGION:-us-central1}}"

POOL_ID="github-actions-pool"
PROVIDER_ID="github-actions-provider"
SA_NAME="github-actions-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo ""
echo "[*] Configuration Summary:"
echo "    - Project ID:     ${PROJECT_ID}"
echo "    - Region:         ${REGION}"
echo "    - GitHub Target:  ${GITHUB_OWNER}/${GITHUB_REPO}"
echo "    - WIF Pool ID:    ${POOL_ID}"
echo "    - WIF Provider:   ${PROVIDER_ID}"
echo "    - Service Account:${SA_EMAIL}"
echo ""

# ------------------------------------------------------------------------------
# Step 1: Enable Required Google Cloud APIs
# ------------------------------------------------------------------------------
echo "[*] Step 1: Enabling required Google Cloud APIs..."
APIS=(
  "iam.googleapis.com"
  "cloudresourcemanager.googleapis.com"
  "iamcredentials.googleapis.com"
  "sts.googleapis.com"
  "serviceusage.googleapis.com"
)

for api in "${APIS[@]}"; do
  echo "    - Enabling ${api}..."
  gcloud services enable "${api}" --project="${PROJECT_ID}" --quiet
done
echo "[+] Required Google Cloud APIs enabled."

# Retrieve numeric project number required for WIF resource names
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
echo "[*] Resolved GCP Project Number: ${PROJECT_NUMBER}"

# ------------------------------------------------------------------------------
# Step 2: Create Workload Identity Pool (Idempotent)
# ------------------------------------------------------------------------------
echo "[*] Step 2: Configuring Workload Identity Pool '${POOL_ID}'..."
if gcloud iam workload-identity-pools describe "${POOL_ID}" \
    --project="${PROJECT_ID}" \
    --location="global" &>/dev/null; then
  echo "[+] Workload Identity Pool '${POOL_ID}' already exists."
else
  gcloud iam workload-identity-pools create "${POOL_ID}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --display-name="GitHub Actions Pool" \
    --description="Workload Identity Pool for JavaDrill GitHub Actions CI/CD"
  echo "[+] Created Workload Identity Pool '${POOL_ID}'."
fi

# ------------------------------------------------------------------------------
# Step 3: Create Workload Identity Provider for GitHub (Idempotent)
# ------------------------------------------------------------------------------
echo "[*] Step 3: Configuring OIDC Provider '${PROVIDER_ID}'..."
ATTRIBUTE_MAPPINGS="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner"
ATTRIBUTE_CONDITION="assertion.repository_owner == '${GITHUB_OWNER}' && assertion.repository == '${GITHUB_OWNER}/${GITHUB_REPO}'"

if gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="${POOL_ID}" &>/dev/null; then
  echo "[*] OIDC Provider '${PROVIDER_ID}' already exists. Updating configuration..."
  gcloud iam workload-identity-pools providers update-oidc "${PROVIDER_ID}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="${POOL_ID}" \
    --attribute-mapping="${ATTRIBUTE_MAPPINGS}" \
    --attribute-condition="${ATTRIBUTE_CONDITION}"
  echo "[+] Updated OIDC Provider '${PROVIDER_ID}'."
else
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="${POOL_ID}" \
    --display-name="GitHub Actions OIDC Provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="${ATTRIBUTE_MAPPINGS}" \
    --attribute-condition="${ATTRIBUTE_CONDITION}"
  echo "[+] Created OIDC Provider '${PROVIDER_ID}'."
fi

# ------------------------------------------------------------------------------
# Step 4: Create Deployer Service Account (Idempotent)
# ------------------------------------------------------------------------------
echo "[*] Step 4: Configuring Service Account '${SA_NAME}'..."
if gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "[+] Service account '${SA_EMAIL}' already exists."
else
  gcloud iam service-accounts create "${SA_NAME}" \
    --project="${PROJECT_ID}" \
    --display-name="GitHub Actions Deployer" \
    --description="Service account for JavaDrill GitHub Actions automated deployment"
  echo "[+] Created service account '${SA_EMAIL}'."
fi

# ------------------------------------------------------------------------------
# Step 5: Bind Workload Identity User to the Service Account
# ------------------------------------------------------------------------------
echo "[*] Step 5: Binding Workload Identity User role to repository..."
WIF_PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_OWNER}/${GITHUB_REPO}"

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="${WIF_PRINCIPAL}" \
  --quiet &>/dev/null
echo "[+] Bound '${WIF_PRINCIPAL}' to '${SA_EMAIL}'."

# ------------------------------------------------------------------------------
# Step 6: Grant Minimal Required Project IAM Roles to Deployer Service Account
# ------------------------------------------------------------------------------
echo "[*] Step 6: Granting project IAM roles to '${SA_EMAIL}'..."
# Minimal required roles:
# 1. roles/run.admin: Manage Cloud Run v2 services and revisions.
# 2. roles/artifactregistry.admin: Manage Docker repos and push container images.
# 3. roles/storage.admin: Manage Terraform state and Litestream backup buckets.
# 4. roles/iam.serviceAccountAdmin: Manage the dedicated runtime service account.
# 5. roles/iam.serviceAccountUser: Attach the runtime service account to Cloud Run.
# 6. roles/secretmanager.admin: Provision and update app secrets in Secret Manager.
# 7. roles/serviceusage.serviceUsageAdmin: Enable runtime APIs declared in Terraform.
# 8. roles/resourcemanager.projectIamAdmin: Authorize public invoker (allUsers) on Cloud Run.
DEPLOYER_ROLES=(
  "roles/run.admin"
  "roles/artifactregistry.admin"
  "roles/storage.admin"
  "roles/iam.serviceAccountAdmin"
  "roles/iam.serviceAccountUser"
  "roles/secretmanager.admin"
  "roles/serviceusage.serviceUsageAdmin"
  "roles/resourcemanager.projectIamAdmin"
)

for role in "${DEPLOYER_ROLES[@]}"; do
  echo "    - Granting ${role}..."
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${role}" \
    --condition=None \
    --quiet &>/dev/null
done
echo "[+] Project IAM roles granted successfully."

# ------------------------------------------------------------------------------
# Step 7: Output GitHub Secrets Configuration
# ------------------------------------------------------------------------------
FULL_WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

echo ""
echo "=============================================================================="
echo "  Bootstrap Completed Successfully!"
echo "=============================================================================="
echo ""
echo "Configure the following GitHub Repository Secrets & Variables in:"
echo "https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/settings/secrets/actions"
echo ""
echo "------------------------------------------------------------------------------"
echo "SECRET / VARIABLE NAME        VALUE"
echo "------------------------------------------------------------------------------"
echo "GCP_PROJECT_ID               ${PROJECT_ID}"
echo "GCP_REGION                   ${REGION}"
echo "GCP_WIF_PROVIDER             ${FULL_WIF_PROVIDER}"
echo "GCP_WIF_SERVICE_ACCOUNT      ${SA_EMAIL}"
echo "ADMIN_USERNAME               admin"
echo "ADMIN_PASSWORD_HASH          <Generate using: node scripts/hash-password.mjs <password>>"
echo "SESSION_SECRET               <Generate using: openssl rand -hex 32>"
echo "------------------------------------------------------------------------------"
echo ""
echo "Quick copy-paste script to set secrets with GitHub CLI (gh):"
echo ""
cat <<EOF
gh secret set GCP_PROJECT_ID --body "${PROJECT_ID}"
gh secret set GCP_REGION --body "${REGION}"
gh secret set GCP_WIF_PROVIDER --body "${FULL_WIF_PROVIDER}"
gh secret set GCP_WIF_SERVICE_ACCOUNT --body "${SA_EMAIL}"
gh secret set ADMIN_USERNAME --body "admin"
# Generate and set ADMIN_PASSWORD_HASH:
# gh secret set ADMIN_PASSWORD_HASH --body "\$(node scripts/hash-password.mjs 'YourStrongPasswordHere')"
# Generate and set SESSION_SECRET:
# gh secret set SESSION_SECRET --body "\$(openssl rand -hex 32)"
EOF
echo ""
echo "Done! You can now trigger the deployment pipeline in GitHub Actions."
