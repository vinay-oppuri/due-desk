import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DRIZZLE } from './drizzle/index.js';

describe('AppController', () => {
  let appController: AppController;

  const mockDb = {
    execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return status ok and connected database', async () => {
      const result = await appController.health();
      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
    });
  });
});
