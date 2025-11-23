const fs = require('fs').promises;
const path = require('path');

class PositionsManager {
    constructor(client) {
        this.client = client;
        this.config = client.config;
        this.dbPath = path.join(process.cwd(), 'data', 'positions.json');
        this.positions = new Map();
    }

    async initialize() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            await fs.mkdir(dataDir, { recursive: true });

            // Load existing positions
            await this.loadPositions();
            console.log('✅ Positions manager initialized');
        } catch (error) {
            console.error('❌ Error initializing positions manager:', error);
        }
    }

    async loadPositions() {
        try {
            const data = await fs.readFile(this.dbPath, 'utf8');
            const parsed = JSON.parse(data);
            
            this.positions = new Map(Object.entries(parsed));
            console.log(`📋 Loaded ${this.positions.size} positions from database`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, create empty database
                this.positions = new Map();
                await this.savePositions();
                console.log('📋 Created new positions database');
            } else {
                console.error('❌ Error loading positions:', error);
            }
        }
    }

    async savePositions() {
        try {
            const data = Object.fromEntries(this.positions);
            await fs.writeFile(this.dbPath, JSON.stringify(data, null, 4), 'utf8');
        } catch (error) {
            console.error('❌ Error saving positions:', error);
            throw error;
        }
    }

    async addPosition(department, roleId, status, note = null) {
        const key = `${department}-${roleId}`;
        
        this.positions.set(key, {
            department,
            roleId,
            status,
            note,
            addedAt: Date.now()
        });

        await this.savePositions();
        return true;
    }

    async removePosition(department, roleId) {
        const key = `${department}-${roleId}`;
        
        if (!this.positions.has(key)) {
            return false;
        }

        this.positions.delete(key);
        await this.savePositions();
        return true;
    }

    async updatePosition(department, roleId, updates) {
        const key = `${department}-${roleId}`;
        
        if (!this.positions.has(key)) {
            return false;
        }

        const current = this.positions.get(key);
        this.positions.set(key, {
            ...current,
            ...updates,
            updatedAt: Date.now()
        });

        await this.savePositions();
        return true;
    }

    getPositionsByDepartment() {
        const departments = new Map();

        for (const [key, position] of this.positions) {
            if (!departments.has(position.department)) {
                departments.set(position.department, []);
            }
            departments.get(position.department).push(position);
        }

        return departments;
    }

    getAllPositions() {
        return Array.from(this.positions.values());
    }

    hasPositions() {
        return this.positions.size > 0;
    }

    getDepartments() {
        const depts = new Set();
        for (const position of this.positions.values()) {
            depts.add(position.department);
        }
        return Array.from(depts);
    }

    // Get available roles for a department from config
    getRolesForDepartment(department) {
        const deptConfig = this.config.hiring.departments[department];
        if (!deptConfig) return [];

        return Object.entries(deptConfig.roles).map(([roleName, roleId]) => ({
            name: roleName,
            id: roleId
        }));
    }

    // Get all departments from config
    getAvailableDepartments() {
        return Object.keys(this.config.hiring.departments || {});
    }

    // Get department emoji
    getDepartmentEmoji(department) {
        return this.config.hiring.departments[department]?.emoji || '📁';
    }
}

module.exports = PositionsManager;