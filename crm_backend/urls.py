from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from crm.views import CustomerViewSet, write_frontend_logs, dashboard_analytics_v2
from crm.analytics_views import dashboard_kpis, dashboard_aging, dashboard_products, analytics_geo, analytics_pareto
from crm.config_views import system_config_view
from crm.auth_views import login_view, users_view, user_detail_view
from crm.order_views import orders_list, orders_analytics
from crm.escalation_views import escalations_list, resolve_escalation
from crm.health_views import health_check

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'api/v1/customers', CustomerViewSet, basename='customer')

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/debug/frontend-logs/', write_frontend_logs, name='frontend-logs'),

    # Health
    path('api/v1/health/', health_check, name='health-check'),

    # Auth
    path('api/v1/auth/login/', login_view, name='auth-login'),

    # User management (Owner only)
    path('api/v1/users/', users_view, name='users-list'),
    path('api/v1/users/<str:user_id>/', user_detail_view, name='user-detail'),

    # Orders
    path('api/v1/orders/', orders_list, name='orders-list'),
    path('api/v1/orders/analytics/', orders_analytics, name='orders-analytics'),

    # Escalations
    path('api/v1/escalations/', escalations_list, name='escalations-list'),
    path('api/v1/escalations/<int:escalation_id>/resolve/', resolve_escalation, name='escalation-resolve'),

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
