const fs = require('fs').promises;
const path = require('path');

class TicketUsersManager {
    constructor(client) {
        this.client = client;
        this.dbPath = path.join(process.cwd(), 'data', 'ticket-users.json');
        this.ticketUsers = new Map(); // channelId -> Set of userIds
    }

    async initialize() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            await fs.mkdir(dataDir, { recursive: true });

            // Load existing ticket users
            await this.loadTicketUsers();
            console.log('✅ Ticket users manager initialized');
        } catch (error) {
            console.error('❌ Error initializing ticket users manager:', error);
        }
    }

    async loadTicketUsers() {
        try {
            const data = await fs.readFile(this.dbPath, 'utf8');
            const parsed = JSON.parse(data);
            
            // Convert arrays back to Sets
            for (const [channelId, userIds] of Object.entries(parsed)) {
                this.ticketUsers.set(channelId, new Set(userIds));
            }
            
            console.log(`📋 Loaded ${this.ticketUsers.size} ticket user lists from database`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, create empty database
                this.ticketUsers = new Map();
                await this.saveTicketUsers();
                console.log('📋 Created new ticket users database');
            } else {
                console.error('❌ Error loading ticket users:', error);
            }
        }
    }

    async saveTicketUsers() {
        try {
            // Convert Sets to arrays for JSON serialization
            const dataToSave = {};
            for (const [channelId, userIds] of this.ticketUsers) {
                dataToSave[channelId] = Array.from(userIds);
            }
            
            await fs.writeFile(this.dbPath, JSON.stringify(dataToSave, null, 4), 'utf8');
        } catch (error) {
            console.error('❌ Error saving ticket users:', error);
            throw error;
        }
    }

    async addUser(channelId, userId) {
        if (!this.ticketUsers.has(channelId)) {
            this.ticketUsers.set(channelId, new Set());
        }
        
        this.ticketUsers.get(channelId).add(userId);
        await this.saveTicketUsers();
        
        console.log(`✅ Added user ${userId} to ticket ${channelId}`);
        console.log(`📋 Current users in ticket: ${Array.from(this.ticketUsers.get(channelId)).join(', ')}`);
    }

    async removeUser(channelId, userId) {
        if (!this.ticketUsers.has(channelId)) {
            return false;
        }
        
        const users = this.ticketUsers.get(channelId);
        const removed = users.delete(userId);
        
        // Clean up empty sets
        if (users.size === 0) {
            this.ticketUsers.delete(channelId);
        }
        
        await this.saveTicketUsers();
        
        if (removed) {
            console.log(`✅ Removed user ${userId} from ticket ${channelId}`);
            console.log(`📋 Remaining users: ${this.ticketUsers.has(channelId) ? Array.from(this.ticketUsers.get(channelId)).join(', ') : 'none'}`);
        }
        
        return removed;
    }

    getAddedUsers(channelId) {
        return this.ticketUsers.has(channelId) 
            ? Array.from(this.ticketUsers.get(channelId))
            : [];
    }

    async clearTicket(channelId) {
        if (this.ticketUsers.has(channelId)) {
            this.ticketUsers.delete(channelId);
            await this.saveTicketUsers();
            console.log(`🧹 Cleared users for ticket ${channelId}`);
        }
    }

    hasUsers(channelId) {
        return this.ticketUsers.has(channelId) && this.ticketUsers.get(channelId).size > 0;
    }
}

module.exports = TicketUsersManager;