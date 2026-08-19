from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from crm.services import ExcelIngestionService

class Command(BaseCommand):
    help = "Loads or updates CRM database from Excel files in data directory"

    def handle(self, *args, **options):
        data_dir = Path(settings.BASE_DIR) / "data"
        if not data_dir.exists():
            self.stderr.write(self.style.ERROR(f"Data directory not found at: {data_dir}"))
            return

        self.stdout.write(self.style.SUCCESS("Starting database ingestion from Excel files..."))
        service = ExcelIngestionService(data_dir)
        try:
            service.run_full_import()
            self.stdout.write(self.style.SUCCESS("Successfully ingested Excel data into PostgreSQL."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Ingestion failed: {str(e)}"))