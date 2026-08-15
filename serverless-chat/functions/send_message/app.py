import json
import os
from datetime import datetime, timezone

import boto3


dynamodb = boto3.resource("dynamodb")

connections_table = dynamodb.Table(
    os.environ["CONNECTIONS_TABLE"]
)

messages_table = dynamodb.Table(
    os.environ["MESSAGES_TABLE"]
)

apigateway = boto3.client(
    "apigatewaymanagementapi",
    endpoint_url=os.environ["WEBSOCKET_ENDPOINT"]
)


def lambda_handler(event, context):

    body = json.loads(event.get("body", "{}"))

    room_id = body.get("roomId", "general")
    sender = body.get("sender", "Anonymous")
    message = body.get("message", "").strip()

    if not message:
        return {
            "statusCode": 400,
            "body": "Message cannot be empty"
        }

    timestamp = datetime.now(timezone.utc).isoformat()

    chat_message = {
        "roomId": room_id,
        "timestamp": timestamp,
        "sender": sender,
        "message": message
    }

    # Store message
    messages_table.put_item(
        Item=chat_message
    )

    # Get active connections
    response = connections_table.scan()

    connections = response.get("Items", [])

    payload = json.dumps({
        "type": "message",
        **chat_message
    }).encode("utf-8")

    # Broadcast message
    for connection in connections:

        connection_id = connection["connectionId"]

        try:
            apigateway.post_to_connection(
                ConnectionId=connection_id,
                Data=payload
            )

        except apigateway.exceptions.GoneException:

            # Remove stale connection
            connections_table.delete_item(
                Key={
                    "connectionId": connection_id
                }
            )

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Message sent"
        })
    }