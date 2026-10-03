import type { FastifyInstance } from "fastify";
import { aiRoutes } from "./ai";
import { authRoutes } from "./auth";
import { contractorRoutes } from "./contractors";
import { coreRoutes } from "./core";
import { emailRoutes } from "./emails";
import { exportRoutes } from "./exports";
import { integrationRoutes } from "./integrations";
import { projectRoutes } from "./projects";
import { reportRoutes } from "./reports";
import { userRoutes } from "./users";

export const allRoutes = [coreRoutes, authRoutes, userRoutes, contractorRoutes, projectRoutes, exportRoutes, aiRoutes, emailRoutes, reportRoutes, integrationRoutes] as ((app: FastifyInstance) => Promise<void>)[];
