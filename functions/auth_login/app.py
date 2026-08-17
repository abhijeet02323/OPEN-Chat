import base64
import hashlib
import hmac
import json
import os
import time

from pymongo import MongoClient


TOKEN_TTL_SECONDS = 60 * 60 * 12


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def make_token(username):
    payload = base64.urlsafe_b64encode(json.dumps({
        "username": username,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }, separators=(",", ":")).encode()).rstrip(b"=")
    signature = hmac.new(
        os.environ["AUTH_TOKEN_SECRET"].encode(), payload, hashlib.sha256
    ).digest()
    return f"{payload.decode()}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid request body."})

    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    client = MongoClient(os.environ["MONGODB_URI"], serverSelectionTimeoutMS=5000)
    try:
        user = client[os.environ["MONGODB_DATABASE"]]["users"].find_one(
            {"usernameKey": username.casefold()}
        )
    finally:
        client.close()

    if not user:
        return response(401, {"error": "Invalid username or password."})

    candidate_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        base64.b64decode(user["passwordSalt"]),
        user["passwordIterations"],
    )
    if not hmac.compare_digest(candidate_hash, base64.b64decode(user["passwordHash"])):
        return response(401, {"error": "Invalid username or password."})

    return response(200, {"username": user["username"], "token": make_token(user["username"])})
