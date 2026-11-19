provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

locals {
  required_services = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "secretmanager.googleapis.com"
  ]
}

# -----------------------------------------------------------------------------
# Enable Required GCP APIs
# -----------------------------------------------------------------------------
resource "google_project_service" "services" {
  for_each           = toset(local.required_services)
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

# -----------------------------------------------------------------------------
# Artifact Registry Repository for Container Images
# Includes Free-Tier cost guardrail cleanup policies
# -----------------------------------------------------------------------------
resource "google_artifact_registry_repository" "docker_repo" {
  repository_id = "${var.app_name}-repo"
  location      = var.region
  format        = "DOCKER"
  description   = "Docker repository for JavaDrill container images"

  cleanup_policies {
    id     = "keep-recent-images"
    action = "KEEP"
    most_recent_versions {
      keep_count = 2
    }
  }

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    condition {
      tag_state = "UNTAGGED"
    }
  }

  depends_on = [google_project_service.services]
}

# -----------------------------------------------------------------------------
# GCS Bucket for SQLite Litestream Backups
# Standard storage class, uniform access, versioned, retention lifecycle
# -----------------------------------------------------------------------------
resource "google_storage_bucket" "sqlite_backup" {
  name                        = lower("${var.project_id}-${var.app_name}-sqlite-data")
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      num_newer_versions         = 5
      days_since_noncurrent_time = 30
      with_state                 = "ARCHIVED"
    }
  }

  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [google_project_service.services]
}

# -----------------------------------------------------------------------------
# Dedicated Runtime Service Account
# -----------------------------------------------------------------------------
resource "google_service_account" "runtime_sa" {
  account_id   = "${var.app_name}-runtime"
  display_name = "JavaDrill Cloud Run Runtime Service Account"
  description  = "Dedicated least-privilege service account for Cloud Run runtime"

  depends_on = [google_project_service.services]
}

# -----------------------------------------------------------------------------
# IAM Bindings (Least Privilege)
# -----------------------------------------------------------------------------
# Grant Litestream storage access ONLY to the SQLite backup bucket
resource "google_storage_bucket_iam_member" "litestream_storage" {
  bucket = google_storage_bucket.sqlite_backup.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.runtime_sa.email}"
}

# Secret 1: Admin Password Hash
resource "google_secret_manager_secret" "admin_password_hash" {
  secret_id = "${var.app_name}-admin-password-hash"

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "admin_password_hash" {
  secret      = google_secret_manager_secret.admin_password_hash.id
  secret_data = var.admin_password_hash
}

resource "google_secret_manager_secret_iam_member" "admin_password_hash_access" {
  secret_id = google_secret_manager_secret.admin_password_hash.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime_sa.email}"
}

# Secret 2: Session Secret
resource "google_secret_manager_secret" "session_secret" {
  secret_id = "${var.app_name}-session-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "session_secret" {
  secret      = google_secret_manager_secret.session_secret.id
  secret_data = var.session_secret
}

resource "google_secret_manager_secret_iam_member" "session_secret_access" {
  secret_id = google_secret_manager_secret.session_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime_sa.email}"
}

# -----------------------------------------------------------------------------
# Cloud Run v2 Service (Serverless, Scale-to-Zero, Max 1 Instance for SQLite)
# -----------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "app" {
  name     = var.app_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.runtime_sa.email
    timeout         = "60s"

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      image = var.container_image

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "SQLITE_DB_PATH"
        value = "/data/app.db"
      }

      env {
        name  = "LITESTREAM_GCS_BUCKET"
        value = google_storage_bucket.sqlite_backup.name
      }

      env {
        name  = "ADMIN_USERNAME"
        value = var.admin_username
      }

      env {
        name  = "EXECUTION_TIMEOUT_MS"
        value = tostring(var.execution_timeout_ms)
      }

      env {
        name  = "COMPILE_TIMEOUT_MS"
        value = tostring(var.compile_timeout_ms)
      }

      env {
        name  = "MAX_CONCURRENT_RUNS"
        value = tostring(var.max_concurrent_runs)
      }

      env {
        name = "ADMIN_PASSWORD_HASH"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.admin_password_hash.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.session_secret.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 2
        period_seconds        = 5
        failure_threshold     = 12
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  depends_on = [
    google_project_service.services,
    google_storage_bucket_iam_member.litestream_storage,
    google_secret_manager_secret_iam_member.admin_password_hash_access,
    google_secret_manager_secret_iam_member.session_secret_access,
    google_secret_manager_secret_version.admin_password_hash,
    google_secret_manager_secret_version.session_secret
  ]
}

# -----------------------------------------------------------------------------
# Public Access IAM Policy (Allow Unauthenticated Invocations)
# -----------------------------------------------------------------------------
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
