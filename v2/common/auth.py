"""Authentication and service initialization for Google APIs."""

from google.oauth2 import service_account
from googleapiclient.discovery import build
from v2.common import constants

def get_drive_service():
    """Authenticates using a Service Account and returns the Drive API service."""
    creds = service_account.Credentials.from_service_account_file(
        constants.SERVICE_ACCOUNT_DRIVE_READER, 
        scopes=constants.DRIVE_READ_SCOPES
    )
    return build("drive", "v3", credentials=creds)
