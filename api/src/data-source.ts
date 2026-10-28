import { DataSource } from 'typeorm';

/**
 * Standalone TypeORM DataSource used by the CLI (migration generate/run/revert).
 * The Nest runtime keeps its own connection in `modules/app.module.ts`.
 *
 * tsconfig uses `rootDir: "."`, so this file compiles to `dist/src/data-source.js`.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [__dirname + '/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
});
