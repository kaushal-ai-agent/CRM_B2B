from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from crm.views import CustomerViewSet, write_frontend_logs, dashboard_analytics_v2
from crm.analytics_views import dashboard_kpis, dashboard_aging, dashboard_products, analytics_geo, analytics_pareto
from crm.config_views import system_config_view

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'api/v1/customers', CustomerViewSet, basename='customer')

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/debug/frontend-logs/', write_frontend_logs, name='frontend-logs'),
    
    # Unified Dashboard Analytics
    path('api/v1/analytics/dashboard/', dashboard_analytics_v2),
    
    # Legacy Analytics & Dashboard (keep for now if needed)
    path('api/v1/dashboard/kpis/', dashboard_kpis),
    path('api/v1/dashboard/aging/', dashboard_aging),
    path('api/v1/dashboard/products/', dashboard_products),
    path('api/v1/analytics/geo/', analytics_geo),
    path('api/v1/analytics/pareto/', analytics_pareto),
    
    # Config
    path('api/v1/config/', system_config_view),
    
    path('', include(router.urls)),
]
