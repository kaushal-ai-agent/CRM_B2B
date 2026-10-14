from django.apps import AppConfig


class CrmConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'crm'

    def ready(self):
        """Connect auto-seed to post_migrate signal so it runs after DB is ready."""
        from django.db.models.signals import post_migrate
        post_migrate.connect(_seed_users_handler, sender=self)


def _seed_users_handler(sender, **kwargs):
    """Idempotently create default seed users after every migrate run."""
    try:
        from django.conf import settings
        from .models import CRMUser

        seeds = getattr(settings, 'CRM_SEED_USERS', [])
        for seed in seeds:
            obj, _ = CRMUser.objects.get_or_create(username=seed['username'])
            obj.name = seed['name']
            obj.role = seed['role']
            obj.is_active = True
            obj.set_password(seed['password'])
            obj.save()
    except Exception:
        pass
