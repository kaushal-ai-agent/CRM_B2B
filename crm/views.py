import json

from django.conf import settings
from django.http import Http404
from rest_framework import filters, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Customer
from .serializers import CustomerListSerializer, Customer360Serializer

class CustomerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows customers to be viewed or searched.
    """
    queryset = Customer.objects.all().order_by('company_name')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    
    # Enable search box functionality in the frontend
    search_fields = ['company_name', 'gstin', 'whatsapp_number']
    
    # Enable dropdown filters in the frontend
    filterset_fields = ['customer_tier', 'industry_segment', 'is_dormant']

    def get_serializer_class(self):
        # If fetching a specific customer ID, return the massive 360 view
        if self.action == 'retrieve':
            return Customer360Serializer
        
        # If fetching the list of all customers, return the lightweight data
        return CustomerListSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def write_frontend_logs(request):
    """Append capped browser diagnostics locally while Django runs in DEBUG mode."""
    if not settings.DEBUG:
        raise Http404

    events = request.data.get('events', [])
    if not isinstance(events, list):
        return Response({'detail': 'events must be a list'}, status=status.HTTP_400_BAD_REQUEST)

    safe_events = events[:50]
    log_directory = settings.BASE_DIR / 'logs'
    log_directory.mkdir(exist_ok=True)
    log_path = log_directory / 'frontend.log'

    with log_path.open('a', encoding='utf-8') as log_file:
        for event in safe_events:
            log_file.write(json.dumps(event, ensure_ascii=False, default=str) + '\n')

    return Response({'accepted': len(safe_events)}, status=status.HTTP_202_ACCEPTED)
