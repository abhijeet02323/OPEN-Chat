import os

import boto3


dynamodb = boto3.resource("dynamodb")

connections_table = dynamodb.Table(
    os.environ["CONNECTIONS_TABLE"]
)


def lambda_handler(event, context):

    connection_id = event["requestContext"]["connectionId"]

    connections_table.delete_item(
        Key={
            "connectionId": connection_id
        }
    )

    print(f"WebSocket disconnected: {connection_id}")

    return {
        "statusCode": 200
    }