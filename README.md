# TicketPilot Bot

This is a simple Ticket Bot

---

## 📁 Project Structure

```
ticket-bot/
├── src/
│   ├── commands/
│   │   └── ticket.js
│   │   └── close.js
│   │   └── ping.js
│   ├── events/
│   │   └── interactionCreate.js
│   │   └── ready.js
│   ├── utils/
│   │   └── ticketManager.js
│   ├── events/
│   └── events/
├── .env
├── .gitignore
├── package.json
└── README.md
```

---

## 🛠️ Features

- Personalized main menu
- Multiple ticket types
- `/ticket` and `/close` slash commands
- Lightweight and modular structure
- Uses `.env` for easy configuration

---

## 🚀 Getting Started

### 1. Clone the Repo
```bash
git clone https://github.com/007codename/discord-ticket-bot.git
cd discord-ticket-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Rename the `.env.example` file to `.env` and add the required info:
```env
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here
SUPPORT_CHANNEL_ID=your_support_channel_id_here
TICKET_CATEGORY_ID=your_ticket_category_id_here
TICKET_LOGS_CHANNEL_ID=your_ticket_logs_channel_id_here
STAFF_ROLE_ID=your_staff_role_id_here
PARTNERSHIP_ROLE_ID=your_partnership_role_id_here
```
⚠️ Don't share this. It's excluded from version control via `.gitignore`.

### 4. Run the Bot
```bash
node index.js
```

---

## 🧠 Notes
- Make sure **"Server Members Intent"** & **"Message Content Intent"** are enabled in the [Discord Developer Portal](https://discord.com/developers/applications).

---

## 📜 License
MIT License. Fork it. Remix it. Break it.

---

## 🧑‍💻 Author
Discord: **@007codename**
