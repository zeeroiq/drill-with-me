#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# JavaDrill Terraform Remote State Bucket Bootstrapper
#
# Idempotently checks for and creates the GCS bucket used to store Terraform
# remote state for DwM.
#
# Arguments:
#   $1 - PROJECT_ID (optional, fallback to $GCP_PROJECT_ID or gcloud active project)
#   $2 - APP_NAME   (optional, fallback to $APP_NAME or "drill-with-me")
#   $3 - REGION     (optional, fallback to $GCP_REGION or "us-central1")
# ==============================================================================

PROJECT_ID="${1:-${GCP_PROJECT_ID:-}}"
if [[ -z "${PROJECT_ID}" ]]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
fi

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "[-] ERROR: GCP Project ID is required. Pass as \$1, set \$GCP_PROJECT_ID, or configure 'gcloud config set project <id>'." >&2
  exit 1
fi

APP_NAME="${2:-${APP_NAME:-drill-with-me}}"
REGION="${3:-${GCP_REGION:-us-central1}}"

# Bucket name must be globally unique and lowercase
BUCKET_NAME=$(echo "${PROJECT_ID}-${APP_NAME}-tfstate" | tr '[:upper:]' '[:lower:]')

echo "[*] Checking Terraform remote state bucket gs://${BUCKET_NAME} in project '${PROJECT_ID}' (${REGION})..."

# Idempotent check: describe bucket using gcloud storage or fallback to gsutil
if gcloud storage buckets describe "gs://${BUCKET_NAME}" --project="${PROJECT_ID}" &>/dev/null || gsutil ls -b "gs://${BUCKET_NAME}" &>/dev/null; then
  echo "[+] Terraform state bucket gs://${BUCKET_NAME} already exists and is ready."
else
  echo "[*] State bucket does not exist. Creating gs://${BUCKET_NAME}..."
  gcloud storage buckets create "gs://${BUCKET_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --uniform-bucket-level-access \
    --default-storage-class=STANDARD

  echo "[*] Enabling object versioning on gs://${BUCKET_NAME}..."
  gcloud storage buckets update "gs://${BUCKET_NAME}" --versioning

  echo "[*] Enforcing public access prevention on gs://${BUCKET_NAME}..."
  gcloud storage buckets update "gs://${BUCKET_NAME}" --public-access-prevention

  echo "[+] Terraform state bucket gs://${BUCKET_NAME} created and hardened successfully."
fi

# If executing inside a GitHub Actions environment, propagate to GITHUB_ENV
if [[ -n "${GITHUB_ENV:-}" && -w "${GITHUB_ENV}" ]]; then
  echo "TF_STATE_BUCKET=${BUCKET_NAME}" >> "${GITHUB_ENV}"
fi

echo "TF_STATE_BUCKET=${BUCKET_NAME}"
