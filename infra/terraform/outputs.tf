output "service_url" {
  description = "Public HTTPS URL of the deployed Cloud Run service"
  value       = google_cloud_run_v2_service.app.uri
}

output "artifact_registry_repo" {
  description = "Full Artifact Registry repository URL for Docker images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.name}"
}

output "sqlite_backup_bucket" {
  description = "Name of the Google Cloud Storage bucket used for Litestream SQLite backups"
  value       = google_storage_bucket.sqlite_backup.name
}

output "runtime_service_account" {
  description = "Email of the dedicated Cloud Run runtime service account"
  value       = google_service_account.runtime_sa.email
}
