"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const migrator_1 = require("drizzle-orm/node-postgres/migrator");
const client_1 = require("./client");
async function runMigrations(connectionString) {
    const db = (0, client_1.createDbClient)(connectionString);
    await (0, migrator_1.migrate)(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully');
}
