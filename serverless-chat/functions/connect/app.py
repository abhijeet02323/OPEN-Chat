import os

import boto3


dynamodb = boto3.resource("dynamodb")

connections_table = dynamodb.Table(
    os.environ["CONNECTIONS_TABLE"]
)


def lambda_handler(event, context):

    connection_id = event["requestContext"]["connectionId"]

    query_parameters = event.get("queryStringParameters") or {}

    room_id = query_parameters.get("roomId", "general")

    if not room_id:
        room_id = "general"

    connections_table.put_item(
        Item={
            "roomId": room_id,
            "connectionId": connection_id
        }
    )

    print(
        f"Connected: {connection_id} "
        f"to room: {room_id}"
    )

    return {
        "statusCode": 200
    }