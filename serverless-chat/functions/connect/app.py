import os
import boto3


dynamodb = boto3.resource("dynamodb")

connections_table = dynamodb.Table(
    os.environ["CONNECTIONS_TABLE"]
)


def lambda_handler(event, context):

    connection_id = event["requestContext"]["connectionId"]

    connections_table.put_item(
        Item={
            "connectionId": connection_id
        }
    )

    print(f"WebSocket connected: {connection_id}")

    return {
        "statusCode": 200
    }