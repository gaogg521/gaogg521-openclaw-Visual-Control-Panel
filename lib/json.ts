import fs, { promises as fsPromises } from "fs";

export function stripUtf8Bom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

export function parseJsonText<T = any>(text: string): T {
  return JSON.parse(stripUtf8Bom(text)) as T;
}

export function readJsonFileSync<T = any>(filePath: string): T {
  return parseJsonText<T>(fs.readFileSync(filePath, "utf-8"));
}

export async function readJsonFile<T = any>(filePath: string): Promise<T> {
  return parseJsonText<T>(await fsPromises.readFile(filePath, "utf-8"));
}
