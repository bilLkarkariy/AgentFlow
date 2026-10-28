import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1788708673411 implements MigrationInterface {
    name = 'InitialSchema1788708673411'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "webhook_triggers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "secret" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_579f62facb7976cbe6eac0b792b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "name" character varying, "roles" text NOT NULL DEFAULT '', "isActive" boolean NOT NULL DEFAULT true, "organizationId" character varying, "timeZone" character varying, "locale" character varying, "lastLoginAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "task_run" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscriptionItemId" character varying NOT NULL, "executedAt" TIMESTAMP NOT NULL DEFAULT now(), "taskType" character varying NOT NULL DEFAULT 'flow', CONSTRAINT "PK_36326cc52f4708f36ae4e6158cc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e6c67505ff38dbc17d4a9ecc6e" ON "task_run" ("subscriptionItemId") `);
        await queryRunner.query(`CREATE TYPE "public"."agent_flow_node_category_enum" AS ENUM('agent', 'integration')`);
        await queryRunner.query(`CREATE TABLE "agent_flow_node" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "extId" character varying NOT NULL, "type" character varying NOT NULL, "category" "public"."agent_flow_node_category_enum" NOT NULL DEFAULT 'agent', "config" text, "posX" double precision NOT NULL, "posY" double precision NOT NULL, "flowId" uuid, CONSTRAINT "PK_f210355304b1e0778f0e33d7154" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "agent_flow_edge" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sourceId" character varying NOT NULL, "targetId" character varying NOT NULL, "label" character varying, "flowId" uuid, CONSTRAINT "PK_8a80b62b935fa317bd07f6d2d4f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."flow_run_node_status_enum" AS ENUM('pending', 'running', 'failed', 'completed')`);
        await queryRunner.query(`CREATE TABLE "flow_run_node" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "extNodeId" character varying NOT NULL, "output" text, "status" "public"."flow_run_node_status_enum" NOT NULL DEFAULT 'pending', "durationMs" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "runId" uuid, CONSTRAINT "PK_ad418facb247a05b9d93dba0fa3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."flow_run_status_enum" AS ENUM('pending', 'running', 'failed', 'completed')`);
        await queryRunner.query(`CREATE TABLE "flow_run" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."flow_run_status_enum" NOT NULL DEFAULT 'pending', "stats" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "flowId" uuid, CONSTRAINT "PK_858b1dd0d1055c44261ae00d45b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "agent_flow" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "version" integer NOT NULL DEFAULT '1', "name" character varying NOT NULL DEFAULT '', "mappings" text NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "agentId" uuid, CONSTRAINT "PK_6c9ff2355a9c7375942254d9540" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "agents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "dsl" text, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_9c653f28ae19c5884d5baf6a1d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "hubspot_trigger" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventType" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "agentId" uuid NOT NULL, CONSTRAINT "PK_0cde7f0c739005a036b7169d9ed" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "hubspot_credential" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "accessToken" character varying NOT NULL, "refreshToken" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "scope" character varying NOT NULL, "agent_id" uuid, CONSTRAINT "PK_86145e0f98e3b13f4c7a1bef99e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1c16cf649d5cad43b2ef800268" ON "hubspot_credential" ("agent_id") `);
        await queryRunner.query(`CREATE TABLE "gmail_task_run" ("id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "result" json, "error" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cbebc0faf56d6eb4a2b779be7f3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" date NOT NULL, "executionsCount" integer NOT NULL, "timeSavedMinutes" integer NOT NULL, CONSTRAINT "UQ_1967d3323e0adfc879022e90b45" UNIQUE ("date"), CONSTRAINT "PK_5283cad666a83376e28a715bf0e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1967d3323e0adfc879022e90b4" ON "metrics" ("date") `);
        await queryRunner.query(`CREATE TABLE "auth_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" character varying NOT NULL, "userId" character varying NOT NULL, "accessToken" text NOT NULL, "refreshToken" text, "expiresAt" TIMESTAMP, CONSTRAINT "PK_41e9ddfbb32da18c4e85e45c2fd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_eb9e25213961d166a25f403a2f" ON "auth_tokens" ("provider") `);
        await queryRunner.query(`CREATE INDEX "IDX_c25fb956ebada4b256501585cc" ON "auth_tokens" ("userId") `);
        await queryRunner.query(`ALTER TABLE "agent_flow_node" ADD CONSTRAINT "FK_e0d9f82ff520487167e37c77363" FOREIGN KEY ("flowId") REFERENCES "agent_flow"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agent_flow_edge" ADD CONSTRAINT "FK_c2df0e3be2f24438541221981a6" FOREIGN KEY ("flowId") REFERENCES "agent_flow"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "flow_run_node" ADD CONSTRAINT "FK_25f902173366c3f8d5ee75ffff7" FOREIGN KEY ("runId") REFERENCES "flow_run"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "flow_run" ADD CONSTRAINT "FK_9ac10a1588e9f70b1334a1c2abb" FOREIGN KEY ("flowId") REFERENCES "agent_flow"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agent_flow" ADD CONSTRAINT "FK_978b42e1bace11b6675b3163bf3" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hubspot_trigger" ADD CONSTRAINT "FK_f9b99a7d64db35946ed9e5c834b" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hubspot_credential" ADD CONSTRAINT "FK_1c16cf649d5cad43b2ef8002683" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hubspot_credential" DROP CONSTRAINT "FK_1c16cf649d5cad43b2ef8002683"`);
        await queryRunner.query(`ALTER TABLE "hubspot_trigger" DROP CONSTRAINT "FK_f9b99a7d64db35946ed9e5c834b"`);
        await queryRunner.query(`ALTER TABLE "agent_flow" DROP CONSTRAINT "FK_978b42e1bace11b6675b3163bf3"`);
        await queryRunner.query(`ALTER TABLE "flow_run" DROP CONSTRAINT "FK_9ac10a1588e9f70b1334a1c2abb"`);
        await queryRunner.query(`ALTER TABLE "flow_run_node" DROP CONSTRAINT "FK_25f902173366c3f8d5ee75ffff7"`);
        await queryRunner.query(`ALTER TABLE "agent_flow_edge" DROP CONSTRAINT "FK_c2df0e3be2f24438541221981a6"`);
        await queryRunner.query(`ALTER TABLE "agent_flow_node" DROP CONSTRAINT "FK_e0d9f82ff520487167e37c77363"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c25fb956ebada4b256501585cc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eb9e25213961d166a25f403a2f"`);
        await queryRunner.query(`DROP TABLE "auth_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1967d3323e0adfc879022e90b4"`);
        await queryRunner.query(`DROP TABLE "metrics"`);
        await queryRunner.query(`DROP TABLE "gmail_task_run"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1c16cf649d5cad43b2ef800268"`);
        await queryRunner.query(`DROP TABLE "hubspot_credential"`);
        await queryRunner.query(`DROP TABLE "hubspot_trigger"`);
        await queryRunner.query(`DROP TABLE "agents"`);
        await queryRunner.query(`DROP TABLE "agent_flow"`);
        await queryRunner.query(`DROP TABLE "flow_run"`);
        await queryRunner.query(`DROP TYPE "public"."flow_run_status_enum"`);
        await queryRunner.query(`DROP TABLE "flow_run_node"`);
        await queryRunner.query(`DROP TYPE "public"."flow_run_node_status_enum"`);
        await queryRunner.query(`DROP TABLE "agent_flow_edge"`);
        await queryRunner.query(`DROP TABLE "agent_flow_node"`);
        await queryRunner.query(`DROP TYPE "public"."agent_flow_node_category_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6c67505ff38dbc17d4a9ecc6e"`);
        await queryRunner.query(`DROP TABLE "task_run"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "webhook_triggers"`);
    }

}
