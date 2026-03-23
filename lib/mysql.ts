import mysql, { type Pool } from "mysql2/promise";

let pool: Pool | null = null;

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getMysqlPool(): Pool {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: toInt(process.env.MYSQL_PORT, 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "root",
    database: process.env.MYSQL_DATABASE || "openclaw_visualization",
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60_000,
    queueLimit: 0,
  });

  return pool;
}

