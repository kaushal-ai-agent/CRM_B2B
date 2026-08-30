import json
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import SystemConfiguration

@api_view(['GET', 'PUT'])
@permission_classes([AllowAny])
def system_config_view(request):
    if request.method == 'GET':
        configs = SystemConfiguration.objects.all()
        data = {}
        for c in configs:
            try:
                data[c.key] = json.loads(c.value) if isinstance(c.value, str) else c.value
            except:
                data[c.key] = c.value
        return Response(data)
        
    elif request.method == 'PUT':
        data = request.data
        for key, value in data.items():
            SystemConfiguration.objects.update_or_create(
                key=key,
                defaults={'value': json.dumps(value) if not isinstance(value, str) else value}
            )
        return Response({"status": "Configuration updated successfully"})
