import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookTriggerService } from './webhook-trigger.service';
import { WebhookTrigger } from './webhook-trigger.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  delete: jest.fn(),
});

type MockRepo<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('WebhookTriggerService', () => {
  let service: WebhookTriggerService;
  let repo: MockRepo<WebhookTrigger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookTriggerService,
        { provide: getRepositoryToken(WebhookTrigger), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<WebhookTriggerService>(WebhookTriggerService);
    repo = module.get(getRepositoryToken(WebhookTrigger));
  });

  it('creates a trigger with generated secret', async () => {
    (repo.create as jest.Mock).mockReturnValue({ secret: 'sec' });
    (repo.save as jest.Mock).mockResolvedValue({ id: 'id1', secret: 'sec' });

    const result = await service.create();
    expect(repo.create).toHaveBeenCalledWith({ secret: expect.any(String) });
    expect(repo.save).toHaveBeenCalled();
    expect(result).toEqual({ id: 'id1', secret: 'sec' });
  });

  it('finds an existing trigger', async () => {
    const tg = { id: 'id1', secret: 'sec' } as WebhookTrigger;
    (repo.findOneBy as jest.Mock).mockResolvedValue(tg);
    await expect(service.findOne('id1')).resolves.toBe(tg);
  });

  it('throws if trigger not found', async () => {
    (repo.findOneBy as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne('id1')).rejects.toThrow('WebhookTrigger id1 not found');
  });

  it('deletes an existing trigger', async () => {
    (repo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
    await expect(service.remove('id1')).resolves.toBeUndefined();
  });

  it('throws if delete affects none', async () => {
    (repo.delete as jest.Mock).mockResolvedValue({ affected: 0 });
    await expect(service.remove('id1')).rejects.toThrow('WebhookTrigger id1 not found');
  });
});
