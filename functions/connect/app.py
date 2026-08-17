import base64
import hashlib
import hmac
import json
import os
import time

import boto3


dynamodb = boto3.resource("dynamodb")
connections_table = dynamodb.Table(os.environ["CONNECTIONS_TABLE"])


def verify_token(token):
    try:
        payload_part, signature_part = token.split(".")
        expected_signature = hmac.new(
            os.environ["AUTH_TOKEN_SECRET"].encode(),
            payload_part.encode(),
            hashlib.sha256,
        ).digest()
        supplied_signature = base64.urlsafe_b64decode(signature_part + "=" * (-len(signature_part) % 4))
        if not hmac.compare_digest(expected_signature, supplied_signature):
            return None
        payload = json.loads(base64.urlsafe_b64decode(payload_part + "=" * (-len(payload_part) % 4)))
        if not isinstance(payload.get("username"), str) or payload.get("exp", 0) < time.time():
            return None
        return payload["username"]
    except (AttributeError, ValueError, json.JSONDecodeError):
        return None


def lambda_handler(event, context):
    connection_id = event["requestContext"]["connectionId"]
    query_parameters = event.get("queryStringParameters") or {}
    username = verify_token(query_parameters.get("token", ""))

    if not username:
        return {"statusCode": 401, "body": "Authentication required"}

    room_id = query_parameters.get("roomId", "general") or "general"
    connections_table.put_item(Item={
        "roomId": room_id,
        "connectionId": connection_id,
        "username": username,
    })

    return {"statusCode": 200}
