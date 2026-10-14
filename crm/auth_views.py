"""
auth_views.py
Credential-based login and Owner-only user management endpoints.

Endpoints:
    POST   /api/v1/auth/login/           — open (no token required)
    GET    /api/v1/users/                — Owner only
    POST   /api/v1/users/               — Owner only
    PATCH  /api/v1/users/<user_id>/     — Owner only
    DELETE /api/v1/users/<user_id>/     — Owner only
"""
import secrets

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import CRMUser, AuthToken
from .user_serializers import CRMUserSerializer, CreateUserSerializer, PatchUserSerializer


# ---------------------------------------------------------------------------
# Helper — resolve Bearer token to an active Owner user
# ---------------------------------------------------------------------------

def _get_owner(request):
    """
    Returns the CRMUser if the Authorization header contains a valid Bearer
    token belonging to an active Owner.  Returns None otherwise.
    """
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token_str = auth_header[len('Bearer '):]
    try:
        token_obj = AuthToken.objects.select_related('user').get(token=token_str)
    except AuthToken.DoesNotExist:
        return None
    user = token_obj.user
    if not user.is_active or user.role != 'Owner':
        return None
    return user


def _owner_required(request):
    """
    Returns (owner_user, None) on success or (None, Response) with 401/403 error.
    Usage:
        owner, err = _owner_required(request)
        if err: return err
    """
    owner = _get_owner(request)
    if owner is None:
        return None, Response(
            {'detail': 'Owner authentication required.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return owner, None


# ---------------------------------------------------------------------------
# POST /api/v1/auth/login/
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Authenticate a CRM user by username + password.

    Body:
        username   str
        password   str
        login_type "Owner" | "Team"

    Returns 200 with {user, token} on success.
    Returns 400 for missing fields, 401 for bad credentials, 403 for role mismatch / inactive.
    """
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')
    login_type = request.data.get('login_type', 'Team')  # "Owner" or "Team"

    if not username or not password:
        return Response(
            {'detail': 'Username and password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Fetch user
    try:
        user = CRMUser.objects.get(username=username)
    except CRMUser.DoesNotExist:
        return Response(
            {'detail': 'Invalid username or password.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Verify password
    if not user.check_password(password):
        return Response(
            {'detail': 'Invalid username or password.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Check is_active
    if not user.is_active:
        return Response(
            {'detail': 'This account has been deactivated. Contact your Owner.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Enforce login_type / role alignment
    if login_type == 'Owner' and user.role != 'Owner':
        return Response(
            {'detail': 'This account does not have Owner access. Use the Team Member tab.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if login_type == 'Team' and user.role == 'Owner':
        return Response(
            {'detail': 'Owner accounts must use the Owner Login tab.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Generate a fresh token (64 hex chars = 32 bytes of entropy)
    token_str = secrets.token_hex(32)
    AuthToken.objects.create(user=user, token=token_str)

    return Response(
        {
            'user': {
                'id': str(user.id),
                'name': user.name,
                'username': user.username,
                'email': user.email or '',
                'role': user.role,
            },
            'token': token_str,
        },
        status=status.HTTP_200_OK,
    )


# ---------------------------------------------------------------------------
# GET + POST /api/v1/users/
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def users_view(request):
    owner, err = _owner_required(request)
    if err:
        return err

    if request.method == 'GET':
        users = CRMUser.objects.all().order_by('created_at')
        serializer = CRMUserSerializer(users, many=True)
        return Response(serializer.data)

    # POST — create a new team member
    serializer = CreateUserSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    new_user = CRMUser(
        name=data['name'],
        username=data['username'],
        email=data.get('email') or None,
        role=data['role'],
        is_active=True,
    )
    new_user.set_password(data['password'])
    new_user.save()

    return Response(CRMUserSerializer(new_user).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# PATCH + DELETE /api/v1/users/<user_id>/
# ---------------------------------------------------------------------------

@api_view(['PATCH', 'DELETE'])
@permission_classes([AllowAny])
def user_detail_view(request, user_id):
    owner, err = _owner_required(request)
    if err:
        return err

    try:
        target_user = CRMUser.objects.get(id=user_id)
    except CRMUser.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        if str(target_user.id) == str(owner.id):
            return Response(
                {'detail': 'You cannot delete your own account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target_user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH — reset password and/or toggle is_active
    serializer = PatchUserSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    if 'password' in data:
        target_user.set_password(data['password'])
    if 'is_active' in data:
        target_user.is_active = data['is_active']
    target_user.save()

    return Response(CRMUserSerializer(target_user).data)
