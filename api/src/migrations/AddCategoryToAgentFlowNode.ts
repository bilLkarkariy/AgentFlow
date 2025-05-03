import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCategoryToAgentFlowNode implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "agent_flow_node_category_enum" AS ENUM('agent','integration')`);
    await queryRunner.addColumn('agent_flow_node', new TableColumn({
      name: 'category',
      type: 'agent_flow_node_category_enum',
      isNullable: false,
      default: `'agent'`,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('agent_flow_node', 'category');
    await queryRunner.query(`DROP TYPE "agent_flow_node_category_enum"`);
  }
}
