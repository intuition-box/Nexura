import type { Request, Response, NextFunction } from "express";

const strip = (value: unknown, depth = 0): unknown => {
  if (depth > 20 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(v => strip(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([k]) => !k.startsWith("$"))
      .map(([k, v]) => [k, strip(v, depth + 1)])
  );
};

export const stripOperators = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") req.body = strip(req.body);
  next();
};
