# ⚡ OPEN CHAT

A real-time messaging application built using a **serverless AWS architecture**. The project uses **Amazon API Gateway WebSocket APIs, AWS Lambda, and Amazon DynamoDB** to provide real-time communication without maintaining a traditional always-running chat server.

The frontend is a lightweight **HTML, CSS, and JavaScript** application that connects directly to the AWS WebSocket endpoint.

> **Project status:** Working MVP with room-aware real-time messaging, message history, responsive chat UI, and AWS SAM-based infrastructure deployment.New Planned versions are in production.

## 📌 Table of Contents

- [About the Project](#-about-the-project)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [How It Works](#-how-it-works)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation and Setup](#-installation-and-setup)
- [Deploying to AWS](#-deploying-to-aws)
- [Running the Frontend Locally](#-running-the-frontend-locally)
- [Using the Application](#-using-the-application)
- [Testing](#-testing)
- [How This Differs From Traditional Chat Systems](#-how-this-differs-from-traditional-chat-systems)
- [Contributing](#-contributing)
- [License](#-license)
- [Author](#-author)

## 🚀 About the Project

**OPEN Chat** is a real-time chat application designed to demonstrate how a modern messaging system can be built using AWS managed and serverless services.

Instead of running a dedicated Node.js, Python, or Java chat server continuously, the application uses API Gateway WebSocket APIs, Lambda functions, and DynamoDB.

```text
Browser
   │
   │ WebSocket
   ▼
Amazon API Gateway
   │
   ├── $connect
   ├── $disconnect
   ├── sendMessage
   └── getMessages
          │
          ▼
       AWS Lambda
          │
          ▼
      DynamoDB
```

The project demonstrates serverless architecture, WebSocket communication, event-driven backend development, AWS Lambda, DynamoDB, API Gateway WebSocket APIs, AWS SAM, CloudFormation, and room-based messaging.

## ✨ Key Features

### Current

- ⚡ Real-time WebSocket messaging
- 🏠 Room-aware connections
- 💬 Room-specific message history
- 📡 API Gateway WebSocket communication
- ⚙️ AWS Lambda event-driven backend
- 🗄️ DynamoDB persistence
- 🔌 WebSocket connection management
- 👤 Username-based chat identity
- 🧑 User initials/avatar display
- 💭 Message bubbles
- 🕐 Message timestamps
- 📜 Smart automatic scrolling
- 💤 Empty-room state
- 📱 Responsive mobile layout
- ↩️ Back button / leave-chat flow
- 🔄 Room switching
- 🏗️ AWS SAM infrastructure deployment



## 🏗️ Architecture

```text
┌───────────────────────────────────────────┐
│                 Frontend                  │
│        HTML + CSS + JavaScript            │
└───────────────────┬───────────────────────┘
                    │
                    │ WebSocket
                    ▼
┌───────────────────────────────────────────┐
│          Amazon API Gateway               │
│             WebSocket API                 │
│                                           │
│ $connect │ $disconnect │ sendMessage      │
│                    │ getMessages          │
└───────────────────┬───────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────┐
│               AWS Lambda                  │
│                                           │
│ Connect │ Disconnect │ Send │ Get         │
└───────────────────┬───────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────┐
│              Amazon DynamoDB              │
│                                           │
│ Connections Table │ Messages Table        │
└───────────────────────────────────────────┘
```

### Message flow

```text
User
  │
  ▼
WebSocket
  │
  ▼
API Gateway
  │
  ▼
SendMessage Lambda
  │
  ├── Store message → DynamoDB
  │
  └── Broadcast → connected clients
```

### Room-aware connections

```text
ConnectionsTable

roomId       connectionId
────────────────────────────
general      connection-A
general      connection-B
development  connection-C
```

## 🛠️ Technology Stack

| Technology | Purpose | Functionality |
|---|---|---|
| **Python** | Backend runtime | Lambda handlers and chat logic |
| **AWS Lambda** | Serverless compute | Connect, disconnect, send-message, and history operations |
| **Amazon API Gateway WebSocket API** | Real-time transport | WebSocket connections and route handling |
| **Amazon DynamoDB** | NoSQL database | Messages and active connection records |
| **AWS SAM** | Infrastructure/deployment | Defines, builds, and deploys the serverless application |
| **AWS CloudFormation** | Infrastructure provisioning | Creates and updates AWS resources from the SAM template |
| **Boto3** | AWS SDK for Python | DynamoDB and AWS API access from Lambda |
| **HTML5** | Frontend structure | Chat interface |
| **CSS3** | Frontend styling | Responsive UI, message bubbles, mobile layout |
| **JavaScript** | Frontend logic | WebSocket communication, rooms, rendering, and UI state |
| **WebSocket** | Communication protocol | Bidirectional real-time communication |
| **Git** | Version control | Source-code history |
| **GitHub** | Source hosting | Open-source repository |

## 🔄 How It Works

### 1. User joins a room

The browser opens a WebSocket connection using the selected room:

```text
wss://<api-id>.execute-api.<region>.amazonaws.com/prod?roomId=general
```

API Gateway invokes the `$connect` Lambda.

### 2. Connection is stored

The connection is associated with the selected room in DynamoDB.

### 3. Message history

The frontend sends:

```json
{
  "action": "getMessages",
  "roomId": "general"
}
```

The `get_messages` Lambda retrieves messages for that room.

### 4. Send a message

The frontend sends:

```json
{
  "action": "sendMessage",
  "roomId": "general",
  "sender": "sender-username",
  "message": "Hello!"
}
```

The backend stores the message and broadcasts it to connected clients in the relevant room.

### 5. Disconnect

When a WebSocket closes, API Gateway invokes `$disconnect` and the backend removes the connection record.

## 📁 Project Structure

```text
serverless-chat/
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── functions/
│   ├── connect/
│   │   └── app.py
│   ├── disconnect/
│   │   └── app.py
│   ├── send_message/
│   │   └── app.py
│   └── get_messages/
│       └── app.py
│
├── template.yaml
├── samconfig.toml
├── .gitignore
└── README.md
```

### Lambda responsibilities

- **connect:** registers a new WebSocket connection and room.
- **disconnect:** removes a disconnected connection.
- **send_message:** persists and broadcasts chat messages.
- **get_messages:** retrieves stored room messages.
- **frontend:** browser-based chat interface and WebSocket client.
- **template.yaml:** AWS infrastructure definition.

## 📋 Prerequisites

Install:

- Git
- Python 3
- AWS CLI
- AWS SAM CLI
- An AWS account

Verify:

```bash
git --version
python --version
aws --version
sam --version
```

Configure AWS credentials:

```bash
aws configure
```

The AWS identity used for deployment needs sufficient permissions for the resources defined in the SAM template, including CloudFormation, Lambda, API Gateway, DynamoDB, and IAM operations.

## ⚙️ Installation and Setup

### 1. Clone

```bash
git clone https://github.com/<abhijeet02323>/OPEN-chat.git
cd OPEN-Chat
```

### 2. Review configuration

Infrastructure is defined in:

```text
template.yaml
```

Deployment settings are stored in:

```text
samconfig.toml
```

Adjust the region and deployment parameters for your AWS account if required.

### 3. Build

```bash
sam build
```

Expected result:

```text
Build Succeeded
```

### 4. Validate

```bash
aws cloudformation validate-template   --template-body file://template.yaml   --region <your-region>
```

### 5. Deploy

First deployment:

```bash
sam deploy --guided
```

Follow the prompts for stack name, region, stage, CloudFormation confirmation, and IAM permissions.

Later deployments:

```bash
sam deploy
```

## 🌐 Running the Frontend Locally

```bash
cd frontend
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

The frontend uses the WebSocket endpoint of the deployed API.

> For your own deployment, configure the WebSocket endpoint in `frontend/app.js` for your deployed API and region.

## 💬 Using the Application

1. Enter a username.
2. Select a room.
3. Click **Join Chat**.
4. Send messages using the input box.
5. Open another browser/window to test real-time delivery.
6. Join different rooms to test room isolation.
7. Switch rooms using the room controls.
8. Use the back button to leave the chat.

Example:

```text
User A → general
User B → general
User C → development
```

A message sent to `general` should not be delivered to the user connected to `development`.

## 🧪 Testing

The current implementation has been manually tested end-to-end through the deployed AWS architecture.

Tested:

- [x] WebSocket connection
- [x] Room connection
- [x] Real-time message sending
- [x] Real-time message receiving
- [x] Message history
- [x] Multiple connected clients
- [x] Room isolation
- [x] Room switching
- [x] Disconnect flow
- [x] Responsive frontend
- [ ] Automated test suite — planned

## 🆚 How This Differs From Traditional Chat Systems

Traditional chat applications commonly use an always-running application server:

```text
Client
  │
  ▼
Always-running server
  │
  └── Database
```

This project uses managed AWS services:

```text
Client
  │
  ▼
API Gateway WebSocket
  │
  ▼
Lambda
  │
  ▼
DynamoDB
```

| Traditional approach | This project |
|---|---|
| Usually requires continuously running application servers | Uses managed/serverless AWS services |
| Server capacity must be managed | AWS manages underlying infrastructure |
| Application server handles WebSocket connections | API Gateway manages WebSocket connections |
| Backend processes run continuously | Lambda runs in response to events |
| More infrastructure to operate | Less infrastructure to manage |
| Scaling requires more application infrastructure decisions | AWS provides managed scaling capabilities |

> Serverless does not mean that physical servers do not exist. It means the cloud provider manages the underlying server infrastructure instead of the application team managing those servers directly.

## 🔐 Security and Current Limitations

This is currently an **MVP/learning and portfolio project**, not a production-hardened messaging platform.

Current limitations:

- Authentication is not implemented yet.
- The frontend currently supplies the username.
- Production authorization is still being improved.
- Automatic WebSocket reconnection is planned.
- Message pagination is planned.
- Automated tests are planned.
- Advanced rate limiting and abuse prevention are not yet implemented.
- Production monitoring and alerting are not yet fully implemented.



> **New versions are planned.** The roadmap may evolve as the project develops.

## 🤝 Contributing

This project is **open source**, and contributions are welcome.

Contributions can include:

- Bug fixes
- UI/UX improvements
- AWS architecture improvements
- Performance improvements
- Security improvements
- Documentation
- Automated tests
- New chat features
- Infrastructure improvements

### Contribution workflow

1. Fork the repository.
2. Create a branch:

```bash
git checkout -b feature/your-feature
```

3. Make your changes.
4. Test locally.
5. Build:

```bash
sam build
```

6. Commit:

```bash
git add .
git commit -m "Add your feature"
```

7. Push:

```bash
git push origin feature/your-feature
```

8. Open a Pull Request.

Please keep pull requests focused and describe the change clearly.

## 🔖 Versioning

The project will use semantic versioning where practical:

```text
MAJOR.MINOR.PATCH
```

Examples:

```text
v1.0.0
v1.1.0
v1.1.1
v2.0.0
```

Major versions may include architectural or API changes.

## 💰 AWS Cost Considerations

AWS services can incur charges depending on usage. The main services used by this project include:

- Amazon API Gateway
- AWS Lambda
- Amazon DynamoDB
- AWS CloudFormation
- IAM and related infrastructure

Review current AWS pricing before deploying. Remove unused development resources when they are no longer required.

## 🧹 Removing the Deployment

To remove a SAM-managed CloudFormation stack:

```bash
aws cloudformation delete-stack   --stack-name <stack-name>   --region <region>
```

> **Warning:** Deleting the stack can remove resources created by it, including DynamoDB resources and stored data, depending on resource policies. Review the CloudFormation configuration before deleting a production stack.

## 👨‍💻 Author

**Abhijeet Dwivedi**

Computer Science undergraduate specializing in Artificial Intelligence & Data Science, with interests in:

- Cloud Computing
- AWS
- Serverless Architecture
- DevOps
- Backend Engineering
- Linux
- Distributed Systems
- AI & Data Science

## ⭐ Support the Project

If you find the project useful:

- ⭐ Star the repository
- 🍴 Fork the project
- 🐛 Report issues
- 💡 Suggest improvements
- 🔧 Submit pull requests

## 📌 Project Status

**Active Development**

The current version demonstrates a functional serverless real-time chat MVP. More features, security improvements, infrastructure optimizations, and production-oriented capabilities are planned for future releases.

Built with ☁️ **AWS + ⚡ Serverless + WebSockets**
