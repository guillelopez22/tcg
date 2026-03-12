export declare const deckShareCodes: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "deck_share_codes";
    schema: undefined;
    columns: {
        code: import("drizzle-orm/pg-core").PgColumn<{
            name: "code";
            tableName: "deck_share_codes";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 12;
        }>;
        deckId: import("drizzle-orm/pg-core").PgColumn<{
            name: "deck_id";
            tableName: "deck_share_codes";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "deck_share_codes";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export type DeckShareCode = typeof deckShareCodes.$inferSelect;
export type NewDeckShareCode = typeof deckShareCodes.$inferInsert;
