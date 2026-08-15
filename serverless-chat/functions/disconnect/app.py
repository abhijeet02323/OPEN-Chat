import os

import boto3


dynamodb = boto3.resource("dynamodb")

connections_table = dynamodb.Table(
    os.environ["CONNECTIONS_TABLE"]
)


def lambda_handler(event, context):

    connection_id = event["requestContext"]["connectionId"]

    # Find the connection
    response = connections_table.scan(
        FilterExpression="connectionId = :connection_id",
        ExpressionAttributeValues={
            ":connection_id": connection_id
        }
    )

    items = response.get("Items", [])

    if items:

        connection = items[0]

        connections_table.delete_item(
            Key={
                "roomId": connection["roomId"],
                "connectionId": connection_id
            }
        )

        print(
            f"Disconnected: {connection_id} "
            f"from room: {connection['roomId']}"
        )

    return {
        "statusCode": 200
    }