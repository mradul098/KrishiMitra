resource "google_app_engine_application" "example_tfc_app" {
  project     = var.project_id
  location_id = "europe-west1"
}

resource "google_app_engine_standard_app_version" "example_tfc_app_version" {
  delete_service_on_destroy = true
  project                   = var.project_id
  runtime                   = "python39"
  service                   = "tfc-app"
  service_account           = var.workload_sa_email

  version_id = "v1"

  deployment {
    zip {
      source_url = "https://storage.googleapis.com/hackathon_shared_storage/app-engine-example.zip"
    }
  }

  entrypoint {
    shell = "python3 ./main.py"
  }
}