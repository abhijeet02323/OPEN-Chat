import json
import os

import boto3
from boto3.dynamodb.conditions import Key


dynamodb = boto3.resource("dynamodb")

table = dynamodb.Table(
    os.environ["MESSAGES_TABLE"]
)


def lambda_handler(event, context):

    body = json.loads(event.get("body", "{}"))

    room_id = body.get("roomId", "general")

    response = table.query(
        KeyConditionExpression=Key("roomId").eq(room_id)
    )

    messages = response.get("Items", [])

    return {
        "statusCode": 200,
        "body": json.dumps({
            "type": "messageHistory",
            "messages": messages
        })
    }