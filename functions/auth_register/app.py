import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time

from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError


USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_-]{3,30}$")
PASSWORD_ITERATIONS = 310_000
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
    if not USERNAME_PATTERN.fullmatch(username):
        return response(400, {"error": "Username must be 3–30 letters, numbers, hyphens, or underscores."})
    if len(password) < 8 or len(password) > 128:
        return response(400, {"error": "Password must be between 8 and 128 characters."})

    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PASSWORD_ITERATIONS)
    client = MongoClient(os.environ["MONGODB_URI"], serverSelectionTimeoutMS=5000)
    users = client[os.environ["MONGODB_DATABASE"]]["users"]
    users.create_index("usernameKey", unique=True)

    try:
        users.insert_one({
            "username": username,
            "usernameKey": username.casefold(),
            "passwordHash": base64.b64encode(password_hash).decode(),
            "passwordSalt": base64.b64encode(salt).decode(),
            "passwordIterations": PASSWORD_ITERATIONS,
            "createdAt": int(time.time()),
        })
    except DuplicateKeyError:
        return response(409, {"error": "That username is already taken."})
    finally:
        client.close()

    return response(201, {"username": username, "token": make_token(username)})
