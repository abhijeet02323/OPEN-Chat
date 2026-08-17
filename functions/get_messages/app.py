import json
import os

import boto3
from boto3.dynamodb.conditions import Key


dynamodb = boto3.resource("dynamodb")

messages_table = dynamodb.Table(
    os.environ["MESSAGES_TABLE"]
)

connections_table = dynamodb.Table(
    os.environ["CONNECTIONS_TABLE"]
)

apigateway = boto3.client(
    "apigatewaymanagementapi",
    endpoint_url=os.environ["WEBSOCKET_ENDPOINT"]
)


def lambda_handler(event, context):

    connection_id = event["requestContext"]["connectionId"]

    body = json.loads(event.get("body", "{}"))

    room_id = body.get("roomId", "general")

    connection_response = connections_table.query(
        IndexName="ConnectionIdIndex",
        KeyConditionExpression=Key("connectionId").eq(connection_id)
    )
    connection = (connection_response.get("Items") or [None])[0]

    if not connection or connection["roomId"] != room_id:
        return {"statusCode": 401}

    response = messages_table.query(
        KeyConditionExpression=Key("roomId").eq(room_id),
        ScanIndexForward=True
    )

    messages = response.get("Items", [])

    payload = json.dumps({
        "type": "messageHistory",
        "roomId": room_id,
        "messages": messages
    }).encode("utf-8")

    apigateway.post_to_connection(
        ConnectionId=connection_id,
        Data=payload
    )

    return {
        "statusCode": 200
    }
