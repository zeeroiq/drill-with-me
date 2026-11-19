variable "project_id" {
  type        = string
  description = "GCP Project ID"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "GCP Free-tier region: us-central1, us-east1, or us-west1"
}

variable "app_name" {
  type        = string
  default     = "drill-with-me"
  description = "Application name used for resource naming"
}

variable "container_image" {
  type        = string
  description = "Full container image URL in Artifact Registry"
}

variable "admin_username" {
  type        = string
  default     = "admin"
  description = "Admin username for application access"
}

variable "admin_password_hash" {
  type        = string
  sensitive   = true
  description = "Scrypt hash for admin password"
}

variable "session_secret" {
  type        = string
  sensitive   = true
  description = "Session signing secret"
}

variable "execution_timeout_ms" {
  type        = number
  default     = 3000
  description = "Java code execution timeout in milliseconds"
}

variable "compile_timeout_ms" {
  type        = number
  default     = 5000
  description = "Java compilation timeout in milliseconds"
}

variable "max_concurrent_runs" {
  type        = number
  default     = 3
  description = "Maximum concurrent code execution runs"
}
