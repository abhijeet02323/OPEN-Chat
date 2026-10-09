import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")
connections_table = dynamodb.Table(os.environ["CONNECTIONS_TABLE"])


def lambda_handler(event, context):
    request_context = event.get("requestContext", {})
    authorizer = request_context.get("authorizer") or {}
    connection_id = request_context.get("connectionId")
    query = event.get("queryStringParameters") or {}
    room_id = query.get("roomId", "general")

    # Identity comes from the validated Cognito authorizer, never from client input.
    user_id = authorizer.get("userId")
    username = authorizer.get("username") or authorizer.get("email")

    if not connection_id or not user_id:
        return {"statusCode": 401, "body": "Unauthorized"}

    connections_table.put_item(Item={
        "roomId": room_id,
        "connectionId": connection_id,
        "userId": user_id,
        "username": username or user_id,
    })

    return {"statusCode": 200, "body": "Connected"}
