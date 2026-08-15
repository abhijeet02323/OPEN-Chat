import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key


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

    try:
        body = json.loads(
            event.get("body", "{}")
        )

    except json.JSONDecodeError:

        return {
            "statusCode": 400,
            "body": "Invalid JSON"
        }

    room_id = body.get(
        "roomId",
        "general"
    )

    sender = body.get(
        "sender",
        "Anonymous"
    )

    message = body.get(
        "message",
        ""
    ).strip()

    # -----------------------------
    # Validation
    # -----------------------------

    if not message:

        return {
            "statusCode": 400,
            "body": "Message cannot be empty"
        }

    if len(message) > 2000:

        return {
            "statusCode": 400,
            "body": "Message is too long"
        }

    if len(sender) > 100:

        return {
            "statusCode": 400,
            "body": "Sender name is too long"
        }

    # -----------------------------
    # Create message
    # -----------------------------

    message_id = str(uuid.uuid4())

    timestamp = datetime.now(
        timezone.utc
    ).isoformat()

    chat_message = {

        "messageId": message_id,

        "roomId": room_id,

        "timestamp": timestamp,

        "sender": sender,

        "message": message
    }

    # -----------------------------
    # Store message
    # -----------------------------

    messages_table.put_item(
        Item=chat_message
    )

    # -----------------------------
    # Get connections in room
    # -----------------------------

    response = connections_table.query(
        KeyConditionExpression=
        Key("roomId").eq(room_id)
    )

    connections = response.get(
        "Items",
        []
    )

    payload = json.dumps({

        "type": "message",

        **chat_message

    }).encode("utf-8")

    # -----------------------------
    # Broadcast to room
    # -----------------------------

    for connection in connections:

        connection_id = connection[
            "connectionId"
        ]

        try:

            apigateway.post_to_connection(

                ConnectionId=connection_id,

                Data=payload
            )

        except apigateway.exceptions.GoneException:

            connections_table.delete_item(

                Key={

                    "roomId": room_id,

                    "connectionId":
                        connection_id
                }
            )

            print(
                f"Removed stale connection: "
                f"{connection_id}"
            )

    return {
        "statusCode": 200
    }